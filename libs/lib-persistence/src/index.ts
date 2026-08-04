/**
 * `@eightyfourthousand/lib-persistence`
 *
 * Browser-local storage for the translation editor: WASM SQLite on the
 * `opfs-sahpool` VFS, running in a dedicated worker owned by whichever tab
 * currently holds the ownership lock, with other tabs proxying through a
 * SharedWorker coordinator.
 *
 * Spike status (DEV-708): this package exists to prove the architecture's
 * durability, not yet to serve production traffic. See `README.md` for what has
 * been validated and what has not.
 */

export { StorageClient } from './lib/client/storage-client';
export type {
  ClientStatus,
  Role,
  WorkerFactories,
} from './lib/client/storage-client';
export { createStorageClient } from './lib/client/create-client';
export { crc32, verifyChecksum } from './lib/checksum';
export {
  DATABASE_FILE,
  SCHEMA_VERSION,
  VFS_DIRECTORY,
  VFS_NAME,
} from './lib/schema';
export type {
  CacheRecord,
  IntegrityReport,
  JournalAppend,
  JournalEntry,
  OpenReport,
  PassageDocRecord,
  QuotaReport,
  SpineRecord,
  StorageApi,
} from './lib/types';
