/**
 * The local half of the doc model's loader.
 *
 * `@eightyfourthousand/lib-doc-model` declares what a passage source is and
 * knows nothing about where passages are kept; this is the implementation that
 * reads them out of the local database. The dependency runs one way only —
 * this package imports the doc model, never the reverse — because the doc model
 * also has to run in a Next.js route handler, where none of this exists.
 */

import type {
  PassageSnapshot,
  PassageSource,
} from '@eightyfourthousand/lib-doc-model';
import type { PassageDocRecord, StorageApi } from '../types';

/** Where a doc-model snapshot comes from, for the loader's report. */
export const LOCAL_SOURCE_NAME = 'lib-persistence';

/**
 * A `PassageSource` backed by the local SQLite store.
 *
 * Placed first in a loader's source list: it answers from disk, and whatever it
 * cannot answer falls through to the network. Passages it does not hold are
 * omitted rather than returned empty, which is what tells the loader to ask the
 * next source for them.
 */
export const localPassageSource = (storage: StorageApi): PassageSource => ({
  name: LOCAL_SOURCE_NAME,

  async loadPassages(
    _workUuid: string,
    uuids: string[],
  ): Promise<PassageSnapshot[]> {
    const records = await Promise.all(
      uuids.map((uuid) => storage.getPassageDoc(uuid)),
    );
    return records.flatMap((record) =>
      record ? [{ uuid: record.uuid, doc: record.doc }] : [],
    );
  },

  async loadSpine(workUuid: string): Promise<Uint8Array | null> {
    const record = await storage.getSpine(workUuid);
    return record?.doc ?? null;
  },
});

/**
 * Write snapshots fetched from a later source into the local store.
 *
 * Pass as a loader's `cache`. Snapshots carrying only row content are skipped:
 * `passage_docs` holds encoded documents, and a row's content is not one — it
 * becomes a document only once the doc model has seeded it.
 *
 * Every record is written at version 0. Versioning belongs to the sync path,
 * which has the server's version to stamp; a cache fill has nothing to claim.
 */
export const cachePassageSnapshots =
  (storage: StorageApi) =>
  async (workUuid: string, snapshots: PassageSnapshot[]): Promise<void> => {
    const records: Omit<PassageDocRecord, 'updatedAt'>[] = snapshots.flatMap(
      (snapshot) =>
        snapshot.doc
          ? [{ uuid: snapshot.uuid, workUuid, doc: snapshot.doc, version: 0 }]
          : [],
    );
    if (!records.length) return;
    await storage.putPassageDocs(records);
  };
