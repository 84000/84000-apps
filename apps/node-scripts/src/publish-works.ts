/**
 * Publish one or many works from the command line.
 *
 * Thin wrapper over the same pipeline the `publishWork` GraphQL mutation calls, so there is
 * one implementation and the CLI cannot drift from what the editor UI does. Useful for a
 * single work with no function time limit to respect, and for bulk runs.
 *
 * Bulk runs refresh `glossary_term_index` once here rather than once per work. The view is
 * a corpus-wide derivation over glossaries, edges, authorities and names; the publish phase
 * refreshes it by default because a stale read is copied into an immutable artifact, but
 * repeating that for every work in a pass where nothing is being edited dominates the run.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts toh251
 *   ... toh251 --version 1.0.0 --notes "Revised chapter 3"
 *   ... toh251 toh252 toh253
 *   ... --file works.json
 *   ... --all-published --notes "bibliography re-snapshot"
 *   ... --all-published --check          # validate everything, publish nothing
 *   ... --all-published --skip-published-since 2026-08-17T12:00:00Z  # resume a run
 */

import './load-env';
import {
  createServiceRoleClient,
  dedupeRequests,
  drivePublish,
  listPublishedWorks,
  parseWorkList,
  partitionBySince,
  refreshGlossaryTermIndex,
  resolveWork,
  runBatch,
  validateWork,
  type BatchOutcome,
  type WorkRequest,
} from '@eightyfourthousand/lib-publishing/ssr';
import type { DataClient } from '@eightyfourthousand/data-access';
import { formatFindings } from '@eightyfourthousand/lib-publishing';
import { readFileSync } from 'fs';

const flag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
};

const checkOne = async (
  client: DataClient,
  request: WorkRequest,
): Promise<BatchOutcome> => {
  const name = request.label ?? request.work;
  const resolved = await resolveWork({ client, work: request.work });
  if (!resolved) {
    return { ok: false, message: `${name}: no such work.` };
  }

  const validation = await validateWork({ client, workUuid: resolved.uuid });
  if (validation.warnings.length) {
    console.warn(
      `${request.work} warnings:\n${formatFindings(validation.warnings)}\n`,
    );
  }
  if (!validation.ok) {
    return {
      ok: false,
      message: `${name} cannot be published:\n${formatFindings(validation.errors)}`,
    };
  }
  return { ok: true, message: `${name} is publishable.` };
};

const publishOne = async (
  client: DataClient,
  request: WorkRequest,
  { refreshGlossaryIndex }: { refreshGlossaryIndex: boolean },
): Promise<BatchOutcome> => {
  const result = await drivePublish({
    client,
    options: {
      work: request.work,
      version: request.version,
      notes: request.notes,
      refreshGlossaryIndex,
    },
    onProgress: (job) => console.log(`  ... ${job.phase} (job ${job.uuid})`),
  });

  if (!result.ok) {
    if (result.reason === 'work-not-found') {
      return { ok: false, message: `${request.work}: no such work.` };
    }
    if (result.reason === 'already-running') {
      return {
        ok: false,
        message:
          `${request.work}: a publish is already running ` +
          `(job ${result.job.uuid}, phase ${result.job.phase}).`,
      };
    }
    return {
      ok: false,
      message:
        `${request.work}: job ${result.job.uuid} made no progress across successive ticks ` +
        `(phase ${result.job.phase}). Another process may hold its lease; re-run to resume.`,
    };
  }

  const final = result.job;

  if (final.warnings.length) {
    console.warn(`\n${formatFindings(final.warnings)}\n`);
  }

  if (final.status === 'failed') {
    if (final.errors.length) {
      return {
        ok: false,
        message:
          `${request.work}: validation failed, nothing written.\n` +
          formatFindings(final.errors),
      };
    }
    const cleanup = final.error?.includes('CLEANUP FAILED')
      ? ' The failed version could not be cleaned up automatically — needs review.'
      : ' The previously published version is untouched and still serving.';
    return { ok: false, message: `${request.work}: ${final.error}${cleanup}` };
  }

  return {
    ok: true,
    message:
      `${request.work}: published as ${final.version} ` +
      `(version ${final.versionUuid}), counts ${JSON.stringify(final.counts)}.`,
  };
};

const main = async () => {
  const args = process.argv.slice(2);
  const positional = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    // A value belonging to a preceding flag is not a work.
    const previous = args[index - 1];
    return !(
      previous &&
      ['--version', '--notes', '--file', '--skip-published-since'].includes(
        previous,
      )
    );
  });

  const file = flag(args, 'file');
  const allPublished = args.includes('--all-published');
  const checkOnly = args.includes('--check');
  const sinceRaw = flag(args, 'skip-published-since');
  const sharedVersion = flag(args, 'version');
  const sharedNotes = flag(args, 'notes');

  if (!positional.length && !file && !allPublished) {
    console.error(
      'Usage: publish-works <toh|work-uuid>... [--file works.json] [--all-published]\n' +
        '                    [--version X.Y.Z] [--notes "..."] [--check]\n' +
        '                    [--skip-published-since ISO]',
    );
    process.exit(2);
  }

  const client = createServiceRoleClient();

  let requests: WorkRequest[] = [
    ...positional.map((work) => ({ work })),
    ...(file ? parseWorkList(readFileSync(file, 'utf8')) : []),
  ];

  if (allPublished) {
    const published = await listPublishedWorks({ client });
    if (!published.length) {
      console.error(
        'No works have a published version, so there is nothing to republish.',
      );
      process.exit(1);
    }
    requests.push(
      ...published.map((work) => ({ work: work.toh ?? work.uuid })),
    );
  }

  requests = dedupeRequests(requests);

  // A version label is unique per work, so one --version cannot serve several. Better to
  // refuse than to fail on the second work having already published the first.
  if (sharedVersion && requests.length > 1) {
    console.error(
      '--version applies to a single work; version labels are unique per work. ' +
        'Use --file with per-work "version" values instead.',
    );
    process.exit(2);
  }

  requests = requests.map((request) => ({
    ...request,
    version: request.version ?? sharedVersion,
    notes: request.notes ?? sharedNotes,
  }));

  let skipped: WorkRequest[] = [];
  if (sinceRaw) {
    const since = new Date(sinceRaw);
    if (Number.isNaN(since.getTime())) {
      console.error(
        `--skip-published-since "${sinceRaw}" is not a valid date.`,
      );
      process.exit(2);
    }
    const partitioned = partitionBySince({
      requests,
      published: await listPublishedWorks({ client }),
      since,
    });
    requests = partitioned.todo;
    skipped = partitioned.skipped;
    console.log(
      `Skipping ${skipped.length} work(s) already published at or after ${since.toISOString()}.`,
    );
  }

  // Refresh once here rather than per work when there is more than one, and always for
  // --check: validation reads glossary_term_index directly, with no publish phase to
  // refresh it first. A lone publish leaves it to the phase, which is the safe default.
  const refreshOnce = checkOnly || requests.length > 1;
  if (refreshOnce) {
    console.log('Refreshing glossary_term_index once for this run...');
    await refreshGlossaryTermIndex({ client });
  }

  const summary = await runBatch({
    requests,
    onStart: (request, index, total) =>
      console.log(
        `[${index + 1}/${total}] ${request.label ?? request.work} ` +
          `${checkOnly ? 'checking' : 'publishing'}...`,
      ),
    each: async (request) => {
      const outcome = checkOnly
        ? await checkOne(client, request)
        : await publishOne(client, request, {
            refreshGlossaryIndex: !refreshOnce,
          });
      console[outcome.ok ? 'log' : 'error'](`  ${outcome.message}`);
      return outcome;
    },
  });

  const { succeeded, failed } = summary;

  console.log(
    `\n${checkOnly ? 'Checked' : 'Published'} ${succeeded.length}/${requests.length}` +
      `${skipped.length ? `, skipped ${skipped.length}` : ''}` +
      `${failed.length ? `, failed ${failed.length}` : ''}.`,
  );

  if (failed.length) {
    console.error('\nFailed:');
    for (const entry of failed) {
      console.error(`  ${entry.work}`);
    }
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
