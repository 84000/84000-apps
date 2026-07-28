/**
 * Publish a work.
 *
 * Thin wrapper: all pipeline logic lives in `@eightyfourthousand/lib-publishing/ssr` so
 * that the phase 5 publish UI can call exactly the same code path. This script only
 * parses arguments, supplies a service_role client, and turns the result into output and
 * an exit code.
 *
 * A service_role client is required, not a convenience: the `translation-versions`
 * bucket has no storage.objects policy at all, so no user-scoped client can write
 * artifacts.
 *
 * Run:
 *   npx ts-node apps/node-scripts/src/publish-work.ts toh251
 *   npx ts-node apps/node-scripts/src/publish-work.ts toh251 --version 1.0.0
 *   npx ts-node apps/node-scripts/src/publish-work.ts toh251 --dry-run
 *   npx ts-node apps/node-scripts/src/publish-work.ts toh251 --notes "Revised chapter 3"
 */

import { publishWork } from '@eightyfourthousand/lib-publishing/ssr';
import { formatFindings } from '@eightyfourthousand/lib-publishing';
import { loadConfig } from './config';

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
      'Usage: publish-work <toh|work-uuid> [--version X.Y.Z] [--notes "..."] [--dry-run]',
    );
    process.exit(2);
  }

  const { supabase } = loadConfig();

  const result = await publishWork({
    client: supabase,
    options: {
      work,
      version: flag(args, 'version'),
      notes: flag(args, 'notes'),
      dryRun: args.includes('--dry-run'),
    },
  });

  if (result.validation.warnings.length) {
    console.warn(`\n${formatFindings(result.validation.warnings)}\n`);
  }

  switch (result.status) {
    case 'validation-failed':
      console.error('Validation failed. Nothing was written.\n');
      console.error(formatFindings(result.validation.errors));
      process.exit(1);
      break;

    case 'dry-run':
      console.log(
        `Dry run for ${work}: would publish ${result.version} to ${result.artifactRoot}`,
      );
      console.log(`Manifest hash: ${result.manifestHash}`);
      console.log(`Counts: ${JSON.stringify(result.counts)}`);
      break;

    case 'published':
      console.log(`Published ${work} as ${result.version}.`);
      console.log(`Version uuid:  ${result.versionUuid}`);
      console.log(`Artifact root: ${result.artifactRoot}`);
      console.log(`Manifest hash: ${result.manifestHash}`);
      console.log(`Counts: ${JSON.stringify(result.counts)}`);
      break;

    case 'failed':
      console.error(`Publish failed: ${result.error}`);
      if (result.recoveryError) {
        // The one case that needs a human: the failed version could not be cleaned up.
        console.error(
          `\nCLEANUP FAILED — manual intervention required: ${result.recoveryError}`,
        );
      } else if (result.versionUuid) {
        console.error(
          `Rolled back version ${result.versionUuid}; the previously live version is ` +
            `untouched and still serving.`,
        );
      }
      process.exit(1);
      break;
  }
};

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
