/**
 * Default wiring of the storage client to its two worker scripts.
 *
 * The `new URL(..., import.meta.url)` form is what lets webpack (and therefore
 * Next) discover the worker entry points and emit them as separate bundles.
 * Both are module workers, which is the reason for the Safari 16.4 floor: it is
 * the first Safari that supports module workers and SharedWorker together.
 */

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
      new SharedWorker(
        new URL('../coordinator/coordinator.sharedworker.ts', import.meta.url),
        { type: 'module', name: '84000-storage-coordinator' },
      ),
  });

  await client.start();
  return client;
};
