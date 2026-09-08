/**
 * Upload the policy tree in `libs/lib-agent/policies` to the `translation-harness`
 * bucket.
 *
 * Seeds the bucket after the migration that creates it, and re-runs safely
 * afterwards. It writes through `writePolicy`, so a file that already differs is
 * archived before it is replaced, exactly as an edit from a session would be.
 *
 * Runs as service_role, which bypasses RLS — the point is to seed a bucket
 * before anyone holds `harness.edit` on the target project.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/seed-policies.ts
 *   ... --dry-run     # report what would change, write nothing
 */

import './load-env';
import { createServiceRoleClient } from '@eightyfourthousand/lib-publishing/ssr';
import { readPolicy, writePolicy } from '@eightyfourthousand/data-access';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'libs/lib-agent/policies';

const markdownFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return path.endsWith('.md') ? [path] : [];
  });

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  const client = createServiceRoleClient();

  const files = markdownFiles(ROOT).sort();
  if (!files.length) {
    console.error(`No policies found under ${ROOT}.`);
    process.exit(1);
  }

  let changed = 0;
  for (const file of files) {
    const name = relative(ROOT, file).replace(/\.md$/, '');
    const content = readFileSync(file, 'utf8');

    const current = await readPolicy({ client, name });
    if (current?.content === content) {
      console.log(`unchanged ${name}`);
      continue;
    }

    changed += 1;
    if (dryRun) {
      console.log(`${current ? 'would replace' : 'would create'} ${name}`);
      continue;
    }

    const result = await writePolicy({ client, name, content });
    if (!result.written) {
      console.error(`failed    ${name}: ${result.error}`);
      process.exit(1);
    }
    console.log(`${result.created ? 'created  ' : 'replaced '} ${name}`);
  }

  console.log(
    `\n${files.length} policies, ${changed} ${dryRun ? 'would change' : 'changed'}.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
