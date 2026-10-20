/**
 * Build the eText snapshot: a catalog archive and one text archive per collection,
 * read from the `etexts` schema.
 *
 * Run after an OCR job is published. Uploads go to the private `etexts-snapshots` bucket
 * under a new build id, and only a complete build is pointed at by `latest.json`, which
 * is what the studio's download tool serves.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/build-etexts-snapshot.ts --out /tmp/etexts
 *   ... --out /tmp/etexts --collections kangyur/S,tengyur/D   # a partial local build
 *   ... --upload                                               # build, upload, publish
 */

import './load-env';
import {
  buildEtextsSnapshot,
  createEtextsReader,
  createEtextsStorageSink,
  createServiceRoleClient,
  publishEtextsBuild,
  type EtextsSink,
} from '@eightyfourthousand/lib-publishing/ssr';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const flag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
};

const localSink = (dir: string): EtextsSink => ({
  put: async (path, body) => {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  },
});

const main = async () => {
  const args = process.argv.slice(2);
  const out = flag(args, 'out');
  const upload = args.includes('--upload');
  const collections = flag(args, 'collections')
    ?.split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (Boolean(out) === upload) {
    console.error('Pass exactly one of --out <dir> or --upload.');
    process.exit(2);
  }
  if (upload && collections) {
    console.error('--upload builds every collection; drop --collections.');
    process.exit(2);
  }

  const client = createServiceRoleClient();
  const manifest = await buildEtextsSnapshot({
    reader: createEtextsReader(client),
    sink: out ? localSink(out) : createEtextsStorageSink(client),
    collections,
    log: (message) => console.log(message),
  });

  if (upload) {
    await publishEtextsBuild({ client, manifest });
    console.log(`Published build ${manifest.buildId} as latest.`);
  } else {
    console.log(`Wrote build ${manifest.buildId} to ${out}.`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
