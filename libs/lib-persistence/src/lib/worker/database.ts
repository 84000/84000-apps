/**
 * The SQLite database itself, running inside a dedicated worker.
 *
 * This module is worker-only: it touches OPFS synchronous access handles and
 * must never be imported from the main thread. It implements `StorageApi`
 * against `@sqlite.org/sqlite-wasm` on the `opfs-sahpool` VFS, which is chosen
 * over the plain `opfs` VFS because it needs no COOP/COEP headers — the reader
 * and studio apps embed third-party content that cross-origin isolation breaks.
 */

import type { SAHPoolUtil, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { crc32, verifyChecksum } from '../checksum';
import {
  DATABASE_FILE,
  PRAGMAS,
  SCHEMA_STATEMENTS,
  SCHEMA_VERSION,
  SQLITE_MODULE_URL,
  VFS_DIRECTORY,
  VFS_NAME,
} from '../schema';
import type {
  CacheRecord,
  DebugApi,
  IntegrityReport,
  JournalAppend,
  JournalEntry,
  OpenReport,
  PassageDocRecord,
  QuotaReport,
  SpineRecord,
  StorageApi,
} from '../types';

type Db = {
  exec: (opts: unknown) => unknown;
  close: () => void;
  transaction: (fn: () => void) => void;
};

/**
 * Load the SQLite WASM runtime from `public/`, outside the bundler graph.
 *
 * The comment pragmas stop webpack and Turbopack from following the import;
 * see `SQLITE_MODULE_URL` for why the package cannot be bundled at all. The
 * specifier is held in a variable because a literal would be resolved
 * statically despite the pragmas.
 */
const loadSqlite = async (): Promise<Sqlite3Static> => {
  const moduleUrl = SQLITE_MODULE_URL;
  const module = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ moduleUrl
  )) as { default: () => Promise<Sqlite3Static> };
  return module.default();
};

const asBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error(`expected a blob, received ${typeof value}`);
};

/**
 * Request persistent storage for the origin.
 *
 * Without this the origin is "best-effort" and the browser may evict the whole
 * database under pressure — unacceptable when it holds unsynced edits. Returns
 * whether persistence is actually granted, which is a browser decision we do
 * not control (Firefox prompts, Safari grants heuristically).
 */
const requestPersistence = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.storage) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return (await navigator.storage.persist?.()) ?? false;
  } catch (error) {
    console.error('lib-persistence: persist() failed', error);
    return false;
  }
};

/**
 * Owns the open database and implements the storage operations.
 *
 * One instance per dedicated worker. Only the active tab's instance has the
 * database open; other tabs proxy to it through the coordinator.
 */
export class LocalDatabase implements StorageApi, DebugApi {
  #pool: SAHPoolUtil | null = null;
  #db: Db | null = null;

  #requireDb(): Db {
    if (!this.#db) throw new Error('lib-persistence: database is not open');
    return this.#db;
  }

  /** Run a statement, returning rows as arrays. */
  #rows(sql: string, bind: unknown[] = []): unknown[][] {
    return this.#requireDb().exec({
      sql,
      bind,
      rowMode: 'array',
      returnValue: 'resultRows',
    }) as unknown[][];
  }

  #run(sql: string, bind: unknown[] = []): void {
    this.#requireDb().exec({ sql, bind });
  }

  /**
   * Install the VFS, open the database, apply the schema, and check integrity.
   *
   * Integrity is checked on every open rather than lazily: a database that is
   * damaged should be discovered before the editor starts writing into it.
   */
  async open(): Promise<OpenReport> {
    const started = performance.now();

    const sqlite3 = await loadSqlite();

    const pool = await sqlite3.installOpfsSAHPoolVfs({
      name: VFS_NAME,
      directory: VFS_DIRECTORY,
      // Each database needs slots for itself plus its rollback journal and temp
      // files; the default of 6 is too tight once the harness imports copies.
      initialCapacity: 12,
    });
    this.#pool = pool;

    this.#db = new pool.OpfsSAHPoolDb(DATABASE_FILE) as unknown as Db;

    for (const pragma of PRAGMAS) this.#run(pragma);
    for (const statement of SCHEMA_STATEMENTS) this.#run(statement);
    this.#run(`PRAGMA user_version = ${SCHEMA_VERSION}`);

    const integrity = await this.integrityCheck();
    const persisted = await requestPersistence();

    return {
      coldOpenMs: performance.now() - started,
      persisted,
      vfsName: pool.vfsName,
      integrity,
    };
  }

  async close(): Promise<void> {
    this.#db?.close();
    this.#db = null;
  }

  async putPassageDoc(
    record: Omit<PassageDocRecord, 'updatedAt'>,
  ): Promise<void> {
    this.#run(
      `INSERT INTO passage_docs (uuid, work_uuid, doc, version, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(uuid) DO UPDATE SET
         doc = excluded.doc,
         version = excluded.version,
         updated_at = excluded.updated_at`,
      [record.uuid, record.workUuid, record.doc, record.version, Date.now()],
    );
  }

  async putPassageDocs(
    records: Omit<PassageDocRecord, 'updatedAt'>[],
  ): Promise<void> {
    const db = this.#requireDb();
    const now = Date.now();
    db.transaction(() => {
      for (const record of records) {
        this.#run(
          `INSERT INTO passage_docs (uuid, work_uuid, doc, version, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(uuid) DO UPDATE SET
             doc = excluded.doc,
             version = excluded.version,
             updated_at = excluded.updated_at`,
          [record.uuid, record.workUuid, record.doc, record.version, now],
        );
      }
    });
  }

  async getPassageDoc(uuid: string): Promise<PassageDocRecord | null> {
    const rows = this.#rows(
      `SELECT uuid, work_uuid, doc, version, updated_at
         FROM passage_docs WHERE uuid = ?`,
      [uuid],
    );
    if (!rows.length) return null;
    const [id, workUuid, doc, version, updatedAt] = rows[0];
    return {
      uuid: id as string,
      workUuid: workUuid as string,
      doc: asBytes(doc),
      version: version as number,
      updatedAt: updatedAt as number,
    };
  }

  async putSpine(record: Omit<SpineRecord, 'updatedAt'>): Promise<void> {
    this.#run(
      `INSERT INTO spine (work_uuid, doc, version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(work_uuid) DO UPDATE SET
         doc = excluded.doc,
         version = excluded.version,
         updated_at = excluded.updated_at`,
      [record.workUuid, record.doc, record.version, Date.now()],
    );
  }

  async getSpine(workUuid: string): Promise<SpineRecord | null> {
    const rows = this.#rows(
      `SELECT work_uuid, doc, version, updated_at FROM spine WHERE work_uuid = ?`,
      [workUuid],
    );
    if (!rows.length) return null;
    const [id, doc, version, updatedAt] = rows[0];
    return {
      workUuid: id as string,
      doc: asBytes(doc),
      version: version as number,
      updatedAt: updatedAt as number,
    };
  }

  /** Append an unsynced edit, stamping it with a checksum over its payload. */
  async appendJournal(entry: JournalAppend): Promise<number> {
    const checksum = crc32(entry.update);
    const rows = this.#rows(
      `INSERT INTO journal (passage_uuid, work_uuid, update_blob, checksum, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`,
      [entry.passageUuid, entry.workUuid, entry.update, checksum, Date.now()],
    );
    return rows[0][0] as number;
  }

  async readJournal(
    limit?: number,
  ): Promise<{ entries: JournalEntry[]; corruptIds: number[] }> {
    const rows = this.#rows(
      `SELECT id, passage_uuid, work_uuid, update_blob, checksum, created_at
         FROM journal ORDER BY id ASC${limit ? ' LIMIT ?' : ''}`,
      limit ? [limit] : [],
    );

    const entries: JournalEntry[] = [];
    const corruptIds: number[] = [];

    for (const row of rows) {
      const [id, passageUuid, workUuid, update, checksum, createdAt] = row;
      const bytes = asBytes(update);
      if (!verifyChecksum(bytes, checksum as number)) {
        // Never return an entry that fails verification — replaying a corrupt
        // Yjs update would poison the document it is applied to.
        corruptIds.push(id as number);
        continue;
      }
      entries.push({
        id: id as number,
        passageUuid: passageUuid as string,
        workUuid: workUuid as string,
        update: bytes,
        checksum: checksum as number,
        createdAt: createdAt as number,
      });
    }

    return { entries, corruptIds };
  }

  async clearJournal(upToId: number): Promise<number> {
    const rows = this.#rows(`DELETE FROM journal WHERE id <= ? RETURNING id`, [
      upToId,
    ]);
    return rows.length;
  }

  async journalCount(): Promise<number> {
    const rows = this.#rows(`SELECT COUNT(*) FROM journal`);
    return rows[0][0] as number;
  }

  async putCache(record: Omit<CacheRecord, 'updatedAt'>): Promise<void> {
    this.#run(
      `INSERT INTO cache (key, body, expires_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         body = excluded.body,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      [record.key, record.body, record.expiresAt, Date.now()],
    );
  }

  async getCache(key: string): Promise<CacheRecord | null> {
    const rows = this.#rows(
      `SELECT key, body, expires_at, updated_at FROM cache WHERE key = ?`,
      [key],
    );
    if (!rows.length) return null;
    const [id, body, expiresAt, updatedAt] = rows[0];
    return {
      key: id as string,
      body: asBytes(body),
      expiresAt: expiresAt as number,
      updatedAt: updatedAt as number,
    };
  }

  async evictExpiredCache(now: number): Promise<number> {
    const rows = this.#rows(
      `DELETE FROM cache WHERE expires_at < ? RETURNING key`,
      [now],
    );
    return rows.length;
  }

  /**
   * Record a synced passage doc and drop the journal entries it covers.
   *
   * The two writes are one transaction. If they were split across engines, a
   * crash between them would either lose edits (journal cleared first) or
   * replay them twice (doc written first).
   */
  async commitSynced(
    record: Omit<PassageDocRecord, 'updatedAt'>,
    clearJournalUpToId: number,
  ): Promise<void> {
    const db = this.#requireDb();
    db.transaction(() => {
      this.#run(
        `INSERT INTO passage_docs (uuid, work_uuid, doc, version, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(uuid) DO UPDATE SET
           doc = excluded.doc,
           version = excluded.version,
           updated_at = excluded.updated_at`,
        [record.uuid, record.workUuid, record.doc, record.version, Date.now()],
      );
      this.#run(`DELETE FROM journal WHERE id <= ?`, [clearJournalUpToId]);
    });
  }

  async quota(): Promise<QuotaReport> {
    const estimate = (await navigator.storage?.estimate?.()) ?? {};
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
      persisted: (await navigator.storage?.persisted?.()) ?? false,
    };
  }

  /**
   * Check both SQLite's own integrity and every journal checksum.
   *
   * `PRAGMA integrity_check` catches structural damage; the checksum sweep
   * catches a payload that is structurally fine but wrong.
   */
  async integrityCheck(): Promise<IntegrityReport> {
    let databaseErrors: string[] = [];
    try {
      const rows = this.#rows('PRAGMA integrity_check');
      databaseErrors = rows
        .map((row) => String(row[0]))
        .filter((value) => value !== 'ok');
    } catch (error) {
      databaseErrors = [error instanceof Error ? error.message : String(error)];
    }

    const corruptJournalIds: number[] = [];
    let journalEntriesChecked = 0;

    if (!databaseErrors.length) {
      const rows = this.#rows(
        `SELECT id, update_blob, checksum FROM journal ORDER BY id ASC`,
      );
      journalEntriesChecked = rows.length;
      for (const [id, update, checksum] of rows) {
        if (!verifyChecksum(asBytes(update), checksum as number)) {
          corruptJournalIds.push(id as number);
        }
      }
    }

    return {
      databaseOk: databaseErrors.length === 0,
      databaseErrors,
      corruptJournalIds,
      journalEntriesChecked,
    };
  }

  async databaseSize(): Promise<number> {
    if (!this.#pool) return 0;
    const bytes = await this.#pool.exportFile(DATABASE_FILE);
    return bytes.byteLength;
  }

  // --- DebugApi: destructive, spike-only. See the note on `DebugApi`. ---

  async corruptJournalEntry(id: number, payload: Uint8Array): Promise<void> {
    // Deliberately does not recompute the checksum — that is the point.
    this.#run(`UPDATE journal SET update_blob = ? WHERE id = ?`, [payload, id]);
  }

  async pauseVfs(): Promise<void> {
    if (!this.#pool) throw new Error('lib-persistence: no VFS installed');
    this.#db?.close();
    this.#db = null;
    this.#pool.pauseVfs();
  }

  async unpauseVfs(): Promise<IntegrityReport> {
    if (!this.#pool) throw new Error('lib-persistence: no VFS installed');
    this.#pool = await this.#pool.unpauseVfs();

    try {
      this.#db = new this.#pool.OpfsSAHPoolDb(DATABASE_FILE) as unknown as Db;
    } catch (error) {
      // Failing to open is itself a loud, correct outcome for a damaged file.
      return {
        databaseOk: false,
        databaseErrors: [
          error instanceof Error ? error.message : String(error),
        ],
        corruptJournalIds: [],
        journalEntriesChecked: 0,
      };
    }

    return this.integrityCheck();
  }

  async wipe(): Promise<void> {
    for (const table of ['passage_docs', 'spine', 'journal', 'cache']) {
      this.#run(`DELETE FROM ${table}`);
    }
  }
}
