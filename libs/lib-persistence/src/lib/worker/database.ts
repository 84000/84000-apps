/**
 * The storage logic, independent of which SQLite engine is underneath.
 *
 * Every statement here — the schema, the journal checksums, the integrity
 * sweep, the full-text index — runs unchanged in a browser worker on
 * `opfs-sahpool` and in a Node process on a file. That is what lets one
 * persistence library serve browser tabs and a local agent process; see
 * `driver.ts` for the seam and why it is kept narrow.
 *
 * This module itself is environment-agnostic. Only the driver handed to it is
 * not, so importing it does not drag OPFS or `node:sqlite` into a bundle.
 */

import { crc32, verifyChecksum } from '../checksum';
import {
  FTS_TOKENIZER,
  PRAGMAS,
  SCHEMA_STATEMENTS,
  SCHEMA_VERSION,
} from '../schema';
import type { SqlDriver } from '../driver';
import type {
  CacheRecord,
  DebugApi,
  IntegrityReport,
  JournalAppend,
  JournalEntry,
  OpenReport,
  PassageDocRecord,
  PassageTextRecord,
  QuotaReport,
  SearchHit,
  SpineRecord,
  StorageApi,
} from '../types';

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
  #driver: SqlDriver | null = null;
  #connect: () => Promise<SqlDriver>;

  /**
   * @param connect opens the underlying database. Supplying it rather than
   * constructing one here is what keeps this class free of engine specifics.
   */
  constructor(connect: () => Promise<SqlDriver>) {
    this.#connect = connect;
  }

  #require(): SqlDriver {
    if (!this.#driver) throw new Error('lib-persistence: database is not open');
    return this.#driver;
  }

  /** The live driver, for callers that need engine specifics (the harness). */
  get driver(): SqlDriver | null {
    return this.#driver;
  }

  #rows(sql: string, bind: unknown[] = []): unknown[][] {
    return this.#require().rows(sql, bind) as unknown[][];
  }

  #run(sql: string, bind: unknown[] = []): void {
    this.#require().run(sql, bind);
  }

  /**
   * Install the VFS, open the database, apply the schema, and check integrity.
   *
   * Integrity is checked on every open rather than lazily: a database that is
   * damaged should be discovered before the editor starts writing into it.
   */
  async open(): Promise<OpenReport> {
    const started = performance.now();

    this.#driver = await this.#connect();

    for (const pragma of PRAGMAS) this.#run(pragma);
    for (const statement of SCHEMA_STATEMENTS) this.#run(statement);
    // The FTS5 table is created separately because its tokenizer is
    // interpolated rather than bound, and it is a virtual table.
    this.#run(
      `CREATE VIRTUAL TABLE IF NOT EXISTS passage_text USING fts5(
         passage_uuid UNINDEXED,
         work_uuid UNINDEXED,
         text,
         tokenize="${FTS_TOKENIZER}"
       )`,
    );
    this.#run(`PRAGMA user_version = ${SCHEMA_VERSION}`);

    const integrity = await this.integrityCheck();
    const persisted = await requestPersistence();

    return {
      coldOpenMs: performance.now() - started,
      persisted,
      vfsName: this.#driver.name,
      integrity,
    };
  }

  async close(): Promise<void> {
    this.#driver?.close();
    this.#driver = null;
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
    const driver = this.#require();
    const now = Date.now();
    driver.transaction(() => {
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
    const driver = this.#require();
    driver.transaction(() => {
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

  async indexPassageText(records: PassageTextRecord[]): Promise<void> {
    const driver = this.#require();
    driver.transaction(() => {
      for (const record of records) {
        // FTS5 has no upsert, so replace by key.
        this.#run(`DELETE FROM passage_text WHERE passage_uuid = ?`, [
          record.passageUuid,
        ]);
        this.#run(
          `INSERT INTO passage_text (passage_uuid, work_uuid, text)
           VALUES (?, ?, ?)`,
          [record.passageUuid, record.workUuid, record.text],
        );
      }
    });
  }

  async searchPassages(query: string, limit = 20): Promise<SearchHit[]> {
    // A bare user string is not valid FTS5 syntax — a stray quote or hyphen
    // raises a parse error — so quote each token and let FTS5 treat the whole
    // thing as a phrase-or-terms query.
    const terms = query
      .split(/\s+/)
      .map((t) => t.replace(/"/g, ''))
      .filter(Boolean)
      .map((t) => `"${t}"`);
    if (!terms.length) return [];

    const rows = this.#rows(
      `SELECT passage_uuid, work_uuid,
              snippet(passage_text, 2, '[', ']', '…', 12),
              bm25(passage_text)
         FROM passage_text
        WHERE passage_text MATCH ?
        ORDER BY bm25(passage_text)
        LIMIT ?`,
      [terms.join(' '), limit],
    );

    return rows.map(([passageUuid, workUuid, snippet, rank]) => ({
      passageUuid: passageUuid as string,
      workUuid: workUuid as string,
      snippet: snippet as string,
      rank: rank as number,
    }));
  }

  async indexedPassageCount(): Promise<number> {
    return this.#rows(`SELECT count(*) FROM passage_text`)[0][0] as number;
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
    return this.#driver ? this.#driver.size() : 0;
  }

  // --- DebugApi: destructive, spike-only. See the note on `DebugApi`. ---

  async corruptJournalEntry(id: number, payload: Uint8Array): Promise<void> {
    // Deliberately does not recompute the checksum — that is the point.
    this.#run(`UPDATE journal SET update_blob = ? WHERE id = ?`, [payload, id]);
  }

  async pauseVfs(): Promise<void> {
    const driver = this.#require() as SqlDriver & {
      pool?: { pauseVfs: () => unknown };
    };
    if (!driver.pool) {
      throw new Error('lib-persistence: pauseVfs is only available on OPFS');
    }
    driver.close();
    driver.pool.pauseVfs();
  }

  async unpauseVfs(): Promise<IntegrityReport> {
    const driver = this.#require() as SqlDriver & {
      pool?: { unpauseVfs: () => Promise<unknown> };
      reopen?: () => void;
    };
    if (!driver.pool || !driver.reopen) {
      throw new Error('lib-persistence: unpauseVfs is only available on OPFS');
    }
    await driver.pool.unpauseVfs();

    try {
      driver.reopen();
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
    for (const table of [
      'passage_docs',
      'spine',
      'journal',
      'cache',
      'passage_text',
    ]) {
      this.#run(`DELETE FROM ${table}`);
    }
  }
}
