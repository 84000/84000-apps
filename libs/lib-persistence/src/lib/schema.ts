/**
 * The local database schema.
 *
 * Four stores in one engine: passage documents, the per-work spine, the
 * unsynced-edit journal, and the response cache. Keeping them in a single
 * SQLite database is the point of the architecture — it makes "record the sync
 * and drop the journal entries it covers" a single atomic transaction rather
 * than a write-ordering protocol across two storage engines.
 */

/** Bumped whenever `SCHEMA_STATEMENTS` changes in a way that needs migration. */
export const SCHEMA_VERSION = 2;

/**
 * The version at which the `journal` table's own definition last changed.
 *
 * This is the pivot for the migration strategy. Every other table is a cache of
 * server state, so a stale schema is recoverable by dropping and re-fetching.
 * The journal is not — while offline it is the only copy of the user's work — so
 * a step that alters the journal itself cannot be resolved that way and needs a
 * hand-written migration instead.
 *
 * The journal was introduced at version 1 and unchanged by version 2, which only
 * added checksum columns to the other stores. Raise this when the journal's
 * columns change, and register the migration that carries its rows across.
 */
export const JOURNAL_LAST_CHANGED_AT = 1;

/** The database file name inside the SAH pool VFS. */
export const DATABASE_FILE = '/84000-local.sqlite3';

/** The OPFS directory the SAH pool VFS manages. */
export const VFS_DIRECTORY = '.84000-sahpool';

/** The SQLite VFS name to register the pool under. */
export const VFS_NAME = 'opfs-sahpool';

/**
 * Where the SQLite WASM runtime is served from.
 *
 * Loaded at runtime rather than bundled: the package's ESM build contains a
 * dynamic `new Worker(new URL(proxyUri, import.meta.url))` for the plain OPFS
 * VFS's async proxy, which neither Turbopack nor webpack can resolve
 * statically. We never execute it — the SAH pool VFS has no async proxy — but
 * the bundler fails on it anyway.
 *
 * Populate the directory with `node tools/build-storage-assets.mjs <app-dir>`.
 */
export const SQLITE_MODULE_URL = '/sqlite-wasm/index.mjs';

/**
 * Where the bundled SharedWorker coordinator is served from.
 *
 * Turbopack compiles `new Worker(new URL('./x.ts', import.meta.url))` but not
 * the `SharedWorker` form — it emits the entry into `_next/static/media` as a
 * raw file, so the browser receives TypeScript and fails to parse it. The
 * coordinator is therefore pre-bundled by `tools/build-storage-assets.mjs`.
 */
export const COORDINATOR_URL = '/storage-workers/coordinator.js';

/**
 * FTS5 tokenizer for the passage text index.
 *
 * `remove_diacritics 2` folds combining marks across the full Unicode range,
 * which matters disproportionately for this corpus: the translations are dense
 * with IAST transliteration, and a reader on an ASCII keyboard searching
 * `manjusri` or `sariputra` must still match `Mañjuśrī` and `Śāriputra`.
 */
export const FTS_TOKENIZER = 'unicode61 remove_diacritics 2';

/**
 * The full-text index over rendered passage text.
 *
 * Kept here beside the other tables, though it cannot go in the same list: FTS5
 * is a virtual table and its tokenizer is interpolated rather than bound.
 */
export const FTS_STATEMENT = `CREATE VIRTUAL TABLE IF NOT EXISTS passage_text USING fts5(
     passage_uuid UNINDEXED,
     work_uuid UNINDEXED,
     text,
     tokenize="${FTS_TOKENIZER}"
   )`;

/**
 * Tables holding nothing but a local copy of server state.
 *
 * Everything here is re-fetchable, which is what makes "drop it and rebuild"
 * a safe answer to a stale schema. `passage_text` belongs to this set too and is
 * listed separately only because of the FTS5 quirk above.
 */
export const REBUILDABLE_TABLES = [
  'passage_docs',
  'spine',
  'cache',
  'passage_text',
];

const REBUILDABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS passage_docs (
     uuid       TEXT PRIMARY KEY,
     work_uuid  TEXT NOT NULL,
     doc        BLOB NOT NULL,
     checksum   INTEGER NOT NULL,
     version    INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS passage_docs_work
     ON passage_docs (work_uuid)`,

  `CREATE TABLE IF NOT EXISTS spine (
     work_uuid  TEXT PRIMARY KEY,
     doc        BLOB NOT NULL,
     checksum   INTEGER NOT NULL,
     version    INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS cache (
     key        TEXT PRIMARY KEY,
     body       BLOB NOT NULL,
     checksum   INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS cache_expiry
     ON cache (expires_at)`,
];

/**
 * The unsynced-edit journal, which is not a cache of anything.
 *
 * Separated from the rebuildable statements because the difference is load
 * bearing: this table is never dropped by any path in this library. See
 * `JOURNAL_LAST_CHANGED_AT`.
 *
 * `checksum` covers `update_blob` only.
 *
 * Every blob store carries one, for the same reason: `PRAGMA integrity_check`
 * verifies b-tree structure, page linkage and freelist consistency, but *not*
 * BLOB payload bytes. Corruption inside an overflow page leaves the database
 * structurally perfect and the content garbage — measured, and the reason
 * these columns exist. Without them a damaged passage doc opens clean, reads
 * as valid, and syncs to the server.
 */
export const JOURNAL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS journal (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     passage_uuid TEXT NOT NULL,
     work_uuid    TEXT NOT NULL,
     update_blob  BLOB NOT NULL,
     checksum     INTEGER NOT NULL,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS journal_passage
     ON journal (passage_uuid)`,
];

export const SCHEMA_STATEMENTS = [
  ...REBUILDABLE_STATEMENTS,
  ...JOURNAL_STATEMENTS,
];

/** Statements that recreate the re-fetchable tables after a rebuild. */
export const REBUILD_STATEMENTS = [...REBUILDABLE_STATEMENTS, FTS_STATEMENT];

/** What to do with a file stamped at a given `user_version`. */
export type SchemaPlan =
  /** Never written by this library: create everything and stamp it. */
  | { action: 'fresh' }
  /** Already at `SCHEMA_VERSION`: nothing to do. */
  | { action: 'current' }
  /** Older, and only caches are stale: drop and recreate those. */
  | { action: 'rebuild' }
  /** Written by a newer build: this one cannot safely read it. */
  | { action: 'reject-too-new' }
  /** Older than the journal's last change: needs a hand-written migration. */
  | { action: 'reject-journal-migration' };

/**
 * Decide what an open should do about the version it found.
 *
 * Pure and separate from the database so the decision table can be read in one
 * place and tested at every version, including the ones that cannot exist yet.
 */
export const planSchemaReconciliation = (
  foundVersion: number,
): SchemaPlan['action'] => {
  if (foundVersion > SCHEMA_VERSION) return 'reject-too-new';
  if (foundVersion === SCHEMA_VERSION) return 'current';
  // Zero is the SQLite default, i.e. a file this library has never stamped.
  if (foundVersion === 0) return 'fresh';
  // Older. Dropping the caches fixes any change confined to them, but cannot fix
  // a change to the journal, which is the only copy of unsynced work.
  if (foundVersion < JOURNAL_LAST_CHANGED_AT) return 'reject-journal-migration';
  return 'rebuild';
};

/**
 * Pragmas applied on every open.
 *
 * `synchronous=FULL` is deliberate, and measurement says it is free here:
 * journal appends cost 3.71 ms under NORMAL and 3.64 ms under FULL — the same
 * within noise. The per-write cost on this VFS is the OPFS SyncAccessHandle
 * write path plus the worker round trip, not the flush. So FULL is kept as
 * no-cost insurance against the one failure mode renderer-crash testing cannot
 * reach: power loss, where NORMAL can lose a committed transaction.
 *
 * `journal_mode=DELETE` is forced because the SAH pool VFS does not support WAL.
 */
export const PRAGMAS = [
  'PRAGMA journal_mode = DELETE',
  'PRAGMA synchronous = FULL',
  'PRAGMA foreign_keys = ON',
];
