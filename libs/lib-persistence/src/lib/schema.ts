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
export const SCHEMA_VERSION = 1;

/** The database file name inside the SAH pool VFS. */
export const DATABASE_FILE = '/84000-local.sqlite3';

/** The OPFS directory the SAH pool VFS manages. */
export const VFS_DIRECTORY = '.84000-sahpool';

/** The SQLite VFS name to register the pool under. */
export const VFS_NAME = 'opfs-sahpool';

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS passage_docs (
     uuid       TEXT PRIMARY KEY,
     work_uuid  TEXT NOT NULL,
     doc        BLOB NOT NULL,
     version    INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS passage_docs_work
     ON passage_docs (work_uuid)`,

  `CREATE TABLE IF NOT EXISTS spine (
     work_uuid  TEXT PRIMARY KEY,
     doc        BLOB NOT NULL,
     version    INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,

  // The durability-critical table. `checksum` covers `update_blob` only.
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

  `CREATE TABLE IF NOT EXISTS cache (
     key        TEXT PRIMARY KEY,
     body       BLOB NOT NULL,
     expires_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS cache_expiry
     ON cache (expires_at)`,
];

/**
 * Pragmas applied on every open.
 *
 * `synchronous=FULL` is deliberate and costs throughput. The SAH pool VFS gives
 * us durable writes only if SQLite actually flushes at transaction boundaries,
 * and the journal's whole value is that a commit which returned means the data
 * survives a tab kill. `journal_mode=DELETE` is forced because the SAH pool VFS
 * does not support WAL.
 */
export const PRAGMAS = [
  'PRAGMA journal_mode = DELETE',
  'PRAGMA synchronous = FULL',
  'PRAGMA foreign_keys = ON',
];
