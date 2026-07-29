/**
 * Publish a work from the command line.
 *
 * Thin wrapper over the same pipeline the `publishWork` GraphQL mutation calls, so there
 * is one implementation and the CLI cannot drift from what the editor UI does. Useful for
 * bulk work (DEV-559's initial publish) and for driving a large work to completion in one
 * go, with no function time limit to respect.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-work.ts toh251
 *   ... toh251 --version 1.0.0 --notes "Revised chapter 3"
 *   ... toh251 --check        # validate only, publish nothing
 */

import {
  createServiceRoleClient,
  getJob,
  resolveWork,
  startPublish,
  tickJob,
  validateWork,
} from '@eightyfourthousand/lib-publishing/ssr';
import { formatFindings } from '@eightyfourthousand/lib-publishing';

const flag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
};

const main = async () => {
  const args = process.argv.slice(2);
  const work = args.find((arg) => !arg.startsWith('--'));

  if (!work) {
    console.error(
      'Usage: publish-work <toh|work-uuid> [--version X.Y.Z] [--notes "..."] [--check]',
    );
    process.exit(2);
  }

  const client = createServiceRoleClient();

  // --check runs the same SQL rule set the pipeline gates on, writing nothing.
  if (args.includes('--check')) {
    const resolved = await resolveWork({ client, work });
    if (!resolved) {
      console.error(`No work found for "${work}".`);
      process.exit(1);
    }
    const validation = await validateWork({ client, workUuid: resolved.uuid });
    if (validation.warnings.length) {
      console.warn(`${formatFindings(validation.warnings)}\n`);
    }
    if (!validation.ok) {
      console.error(`${work} cannot be published:\n`);
      console.error(formatFindings(validation.errors));
      process.exit(1);
    }
    console.log(`${work} is publishable.`);
    return;
  }

  const started = await startPublish({
    client,
    options: {
      work,
      version: flag(args, 'version'),
      notes: flag(args, 'notes'),
    },
  });

  if (!started.ok) {
    if (started.reason === 'work-not-found') {
      console.error(`No work found for "${work}".`);
    } else {
      console.error(
        `A publish is already running for "${work}"` +
          (started.job ? ` (job ${started.job.uuid}, phase ${started.job.phase}).` : '.'),
      );
    }
    process.exit(1);
  }

  let { job, done } = started.result;

  if (job.warnings.length) {
    console.warn(`\n${formatFindings(job.warnings)}\n`);
  }

  // Unlike a serverless invocation, the CLI has no time limit, so it drives the job all the
  // way to completion rather than relying on an after() continuation.
  //
  // The stall guard is not paranoia: a tick that cannot claim the job (someone else holds
  // the lease) legitimately returns `done: false` having done nothing, and without this the
  // loop becomes a hot spin. Progress is measured by the phase/cursor actually moving.
  const MAX_STALLED_TICKS = 3;
  let stalled = 0;
  let signature = '';

  while (!done) {
    const next = `${job.phase}:${JSON.stringify(job.cursor)}:${job.files.length}`;
    if (next === signature) {
      stalled += 1;
      if (stalled >= MAX_STALLED_TICKS) {
        console.error(
          `Publish job ${job.uuid} made no progress across ${MAX_STALLED_TICKS} ticks ` +
            `(phase ${job.phase}). Another process may hold its lease; re-run to resume.`,
        );
        process.exit(1);
      }
      // Wait out a lease held by a concurrent tick rather than spinning against it.
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    } else {
      stalled = 0;
      signature = next;
      console.log(`  ... ${job.phase} (job ${job.uuid})`);
    }

    const result = await tickJob({ client, jobUuid: job.uuid });
    job = result.job;
    done = result.done;
  }

  const final = (await getJob({ client, jobUuid: job.uuid })) ?? job;

  if (final.status === 'failed') {
    if (final.errors.length) {
      console.error('Validation failed. Nothing was written.\n');
      console.error(formatFindings(final.errors));
    } else {
      console.error(`Publish failed: ${final.error}`);
      if (final.error?.includes('CLEANUP FAILED')) {
        console.error(
          '\nThe failed version could not be cleaned up automatically — needs review.',
        );
      } else {
        console.error(
          'The previously published version is untouched and still serving.',
        );
      }
    }
    process.exit(1);
  }

  console.log(`Published ${work} as ${final.version}.`);
  console.log(`Version uuid:  ${final.versionUuid}`);
  console.log(`Counts: ${JSON.stringify(final.counts)}`);
};

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
