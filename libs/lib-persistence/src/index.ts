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
