/**
 * Rebuild a work's published_* rows from its version artifact, and check health.
 *
 * This is the repair path: the artifact is canonical, so any divergence in the serving
 * tables is fixable without republishing and without touching draft state.
 *
 * Run:
 *   # re-materialize the live version from its artifact
 *   npx ts-node apps/node-scripts/src/rebuild-published-version.ts toh251
 *
 *   # roll back to an older version (rebuild it AND re-point the work at it)
 *   npx ts-node apps/node-scripts/src/rebuild-published-version.ts toh251 \
 *     --version-uuid <uuid> --repoint
 *
 *   # report versions holding rows while not live
 *   npx ts-node apps/node-scripts/src/rebuild-published-version.ts --verify
 *   npx ts-node apps/node-scripts/src/rebuild-published-version.ts --verify --gc
 */

import {
  rebuildPublishedVersion,
  resolveWork,
  verifyPublished,
} from '@eightyfourthousand/lib-publishing/ssr';
import { loadConfig } from './config';

const flag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
};

const runVerify = async ({
  args,
  work,
}: {
  args: string[];
  work?: string;
}) => {
  const { supabase } = loadConfig();
  const gc = args.includes('--gc');

  let workUuid: string | undefined;
  if (work) {
    const resolved = await resolveWork({ client: supabase, work });
    if (!resolved) {
      console.error(`No work found for "${work}".`);
      process.exit(1);
    }
    workUuid = resolved.uuid;
  }

  const result = await verifyPublished({ client: supabase, workUuid, gc });

  for (const empty of result.emptyLiveVersions) {
    console.error(
      `Work ${empty.workUuid} points at version ${empty.versionUuid} but has no ` +
        `published rows. Rebuild it.`,
    );
  }

  for (const orphan of result.orphaned) {
    console.warn(
      `Version ${orphan.version ?? orphan.versionUuid} (work ${orphan.workUuid}) ` +
        `holds rows but is not live: ${JSON.stringify(orphan.rowCounts)}`,
    );
  }

  if (result.collected.length) {
    console.log(`Collected ${result.collected.length} non-live version(s).`);
  }

  if (result.ok) {
    console.log('Published serving layer is consistent.');
    return;
  }

  // Orphans alone are recoverable and expected right after an interrupted publish, so
  // only a live version with no rows is treated as a failure.
  process.exit(result.emptyLiveVersions.length ? 1 : 0);
};

const main = async () => {
  const args = process.argv.slice(2);
  const work = args.find((arg) => !arg.startsWith('--'));

  if (args.includes('--verify')) {
    await runVerify({ args, work });
    return;
  }

  if (!work) {
    console.error(
      'Usage: rebuild-published-version <toh|work-uuid> [--version-uuid <uuid>] ' +
        '[--repoint]\n   or: rebuild-published-version [<toh>] --verify [--gc]',
    );
    process.exit(2);
  }

  const { supabase } = loadConfig();

  const result = await rebuildPublishedVersion({
    client: supabase,
    options: {
      work,
      versionUuid: flag(args, 'version-uuid'),
      repoint: args.includes('--repoint'),
    },
  });

  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`);
  }

  if (result.status === 'failed') {
    console.error(`Rebuild failed: ${result.error}`);
    process.exit(1);
  }

  console.log(
    `Rebuilt ${work} version ${result.version} from its artifact. ` +
      `Counts: ${JSON.stringify(result.counts)}`,
  );
};

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
