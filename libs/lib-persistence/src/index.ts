/**
 * `@eightyfourthousand/lib-persistence`
 *
 * Browser-local storage for the translation editor: WASM SQLite on the
 * `opfs-sahpool` VFS, running in a dedicated worker owned by whichever tab
 * currently holds the ownership lock, with other tabs proxying through a
 * SharedWorker coordinator.
 *
 * Consumers work through `StorageApi`, which names passages, spines, journal
 * entries and cache records — not tables, statements, workers or VFSs. That is
 * deliberate: the backend is meant to stay replaceable, so nothing above this
 * barrel should be able to tell what is underneath it.
 *
 * See `README.md` for the architecture and what has been verified in which
 * browser, and `errors.ts` for the failures that throw rather than return null.
 */

export { StorageClient } from './lib/client/storage-client';
export type {
  ClientStatus,
  Role,
  WorkerFactories,
} from './lib/client/storage-client';
export { createStorageClient } from './lib/client/create-client';
export {
  cachePassageSnapshots,
  localPassageSource,
  LOCAL_SOURCE_NAME,
} from './lib/client/passage-source';
export { crc32, verifyChecksum } from './lib/checksum';
export {
  DatabaseNotOpenError,
  JournalMigrationRequiredError,
  PersistenceError,
  SchemaTooNewError,
} from './lib/errors';
export { SCHEMA_VERSION } from './lib/schema';
export type {
  BlobSweepMode,
  CacheRecord,
  IntegrityReport,
  JournalAppend,
  JournalEntry,
  MigrationReport,
  OpenReport,
  PassageDocRecord,
  PassageTextRecord,
  QuotaReport,
  SearchHit,
  SpineRecord,
  StorageApi,
} from './lib/types';
