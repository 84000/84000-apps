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

/**
 * Server sync (DEV-707 spike).
 *
 * Lives alongside local storage rather than in its own package because the two
 * meet: "record the sync and drop the journal entries it covers" is one
 * transaction against one database. `SupabaseSyncTransport` is the only piece
 * that knows about Supabase — everything else is driven through `SyncTransport`,
 * the same way the storage layer is driven through `driver.ts`.
 */
export { PassageSyncProvider, encodeDoc } from './lib/sync/provider';
export type {
  LatencySample,
  PassageSyncOptions,
  PassageSyncStatus,
} from './lib/sync/provider';
export {
  SupabaseSyncTransport,
  DOC_UPDATE_EVENT,
  passageTopic,
} from './lib/sync/supabase-transport';
export { compactPassageDoc } from './lib/sync/compaction';
export type { CompactionResult } from './lib/sync/compaction';
export type {
  EditorPresence,
  PresenceConfig,
  PresenceHandle,
} from './lib/sync/presence';
export { fromBase64, toBase64 } from './lib/sync/encoding';
export type {
  EncodedUpdate,
  PassageDocState,
  SyncMode,
  SyncSubscription,
  SyncTransport,
} from './lib/sync/types';
