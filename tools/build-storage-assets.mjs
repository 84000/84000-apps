/**
 * Build the runtime assets the storage stack needs served from `public/`.
 *
 * Two things cannot go through Next's bundler, for unrelated reasons:
 *
 * 1. `@sqlite.org/sqlite-wasm` contains
 *    `new Worker(new URL(proxyUri, import.meta.url))` for the plain OPFS VFS's
 *    async proxy, where `proxyUri` is only known at runtime. The SAH pool VFS
 *    never takes that path, but Turbopack and webpack both fail the build on
 *    the unresolvable dynamic import regardless. Serving the 865 KB wasm as a
 *    static asset is the right shape anyway — it does not belong in the initial
 *    page bundle.
 *
 * 2. Turbopack does not compile `new SharedWorker(new URL('./x.ts', ...))`. It
 *    handles the dedicated-worker form, but emits the SharedWorker entry into
 *    `_next/static/media` as a *raw* file, so the browser is served TypeScript
 *    and fails to parse it. Bundling the coordinator here keeps it written in
 *    TypeScript against the shared protocol module, rather than duplicating the
 *    lock names into a hand-written JS file where they could drift apart.
 *
 * Usage: node tools/build-storage-assets.mjs [app-directory]
 */

import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const WASM_FILES = ['index.mjs', 'sqlite3.wasm'];

const targetApp = process.argv[2] ?? 'apps/web-editor';
const publicDir = resolve(process.cwd(), targetApp, 'public');

const require = createRequire(import.meta.url);
const sqliteDist = dirname(require.resolve('@sqlite.org/sqlite-wasm'));

const wasmOut = join(publicDir, 'sqlite-wasm');
await mkdir(wasmOut, { recursive: true });
for (const file of WASM_FILES) {
  await copyFile(join(sqliteDist, file), join(wasmOut, file));
  console.log(`copied  ${file} -> ${targetApp}/public/sqlite-wasm/${file}`);
}

const workerOut = join(publicDir, 'storage-workers');
await mkdir(workerOut, { recursive: true });
await build({
  entryPoints: [
    resolve(
      process.cwd(),
      'libs/lib-persistence/src/lib/coordinator/coordinator.sharedworker.ts',
    ),
  ],
  outfile: join(workerOut, 'coordinator.js'),
  bundle: true,
  format: 'esm',
  target: 'safari16',
  platform: 'browser',
  logLevel: 'warning',
});
console.log(
  `bundled coordinator.sharedworker.ts -> ${targetApp}/public/storage-workers/coordinator.js`,
);
