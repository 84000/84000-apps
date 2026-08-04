/**
 * Default wiring of the storage client to its two worker scripts.
 *
 * The dedicated worker uses the `new URL(..., import.meta.url)` form, which
 * Turbopack recognises and emits as its own bundle. The coordinator cannot:
 * Turbopack does not compile the `SharedWorker` form and serves the raw
 * TypeScript instead, so it is pre-bundled to `public/` by
 * `tools/build-storage-assets.mjs` and loaded by plain URL.
 *
 * Both are module workers, which is the reason for the Safari 16.4 floor — the
 * first Safari supporting module workers and SharedWorker together.
 */

import { COORDINATOR_URL } from '../schema';
import { StorageClient } from './storage-client';

/**
 * Create and start a storage client for this tab.
 *
 * Resolves once the tab can serve queries, whether as owner or as proxy.
 */
export const createStorageClient = async (): Promise<StorageClient> => {
  const client = new StorageClient({
    createDedicatedWorker: () =>
      new Worker(new URL('../worker/sqlite.worker.ts', import.meta.url), {
        type: 'module',
        name: '84000-sqlite',
      }),
    createSharedWorker: () =>
      new SharedWorker(COORDINATOR_URL, {
        type: 'module',
        name: '84000-storage-coordinator',
      }),
  });

  await client.start();
  return client;
};
