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
  JOURNAL_STATEMENTS,
  planSchemaReconciliation,
  PRAGMAS,
  REBUILD_STATEMENTS,
  REBUILDABLE_TABLES,
  SCHEMA_VERSION,
} from '../schema';
import {
  DatabaseNotOpenError,
  JournalMigrationRequiredError,
  SchemaTooNewError,
} from '../errors';
import type { SqlDriver } from '../driver';
import type {
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
} from '../types';

/**
 * How many journal ids to name in one `DELETE ... IN (...)`.
 *
 * SQLite caps bound parameters per statement, and a long offline session can
 * accumulate more entries than that cap, so deletes are chunked. Every chunk runs
 * inside the caller's transaction, so the whole set still commits or rolls back
 * together.
 */
const JOURNAL_DELETE_CHUNK = 500;

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
export class LocalDatabase implements StorageApi {
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
    if (!this.#driver) throw new DatabaseNotOpenError();
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
   * Install the VFS, open the database, reconcile the schema, and check integrity.
   *
   * Integrity is checked on every open rather than lazily: a database that is
   * damaged should be discovered before the editor starts writing into it. What
   * that check covers is deliberately bounded — see `integrityCheck`.
   */
  async open(): Promise<OpenReport> {
    const started = performance.now();

    this.#driver = await this.#connect();

    let migration: MigrationReport;
    try {
      // Outside the migration transaction: `journal_mode` cannot be set inside one.
      for (const pragma of PRAGMAS) this.#run(pragma);
      migration = this.#reconcileSchema();
    } catch (error) {
      // A refused open must leave nothing behind that looks usable. Otherwise the
      // driver stays attached, `#require()` succeeds, and every later call runs
      // against a database this build has just declared it cannot read.
      await this.close();
      throw error;
    }

    const integrity = await this.integrityCheck();
    const persisted = await requestPersistence();

    return {
      coldOpenMs: performance.now() - started,
      persisted,
      vfsName: this.#driver.name,
      integrity,
      migration,
    };
  }

  /**
   * Bring the file's schema to `SCHEMA_VERSION`, or refuse to touch it.
   *
   * The strategy turns on one asymmetry: every table except `journal` is a local
   * copy of server state, so a stale schema is recoverable by dropping and
   * re-fetching. The journal is the only copy of unsynced work, so it is never
   * dropped — a version step that needs to change the journal itself is a hard
   * stop instead.
   *
   * Reading `user_version` before writing it is the point. The previous code
   * stamped the current version unconditionally, so a file written by any older
   * build claimed to be current and was then read with the wrong column
   * expectations.
   */
  #reconcileSchema(): MigrationReport {
    const driver = this.#require();
    const found = this.#rows('PRAGMA user_version')[0][0] as number;
    const plan = planSchemaReconciliation(found);

    // A newer build has already upgraded this file. Forward migration would mean
    // guessing at a future schema, and discarding the journal to resolve a
    // version mismatch is the one outcome this library exists to prevent.
    if (plan === 'reject-too-new') {
      throw new SchemaTooNewError(found, SCHEMA_VERSION);
    }

    if (plan === 'reject-journal-migration') {
      throw new JournalMigrationRequiredError(found, SCHEMA_VERSION);
    }

    const stale = plan === 'rebuild';

    driver.transaction(() => {
      // First, always: the journal is created if absent and otherwise left
      // exactly as it is. No branch below can drop it.
      for (const statement of JOURNAL_STATEMENTS) this.#run(statement);

      if (stale) {
        for (const table of REBUILDABLE_TABLES) {
          this.#run(`DROP TABLE IF EXISTS ${table}`);
        }
      }

      for (const statement of REBUILD_STATEMENTS) this.#run(statement);
      this.#run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });

    return {
      fromVersion: found,
      toVersion: SCHEMA_VERSION,
      rebuilt: stale,
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
      `INSERT INTO passage_docs (uuid, work_uuid, doc, checksum, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(uuid) DO UPDATE SET
         doc = excluded.doc,
         checksum = excluded.checksum,
         version = excluded.version,
         updated_at = excluded.updated_at`,
      [
        record.uuid,
        record.workUuid,
        record.doc,
        crc32(record.doc),
        record.version,
        Date.now(),
      ],
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
          `INSERT INTO passage_docs (uuid, work_uuid, doc, checksum, version, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(uuid) DO UPDATE SET
             doc = excluded.doc,
             checksum = excluded.checksum,
             version = excluded.version,
             updated_at = excluded.updated_at`,
          [
            record.uuid,
            record.workUuid,
            record.doc,
            crc32(record.doc),
            record.version,
            now,
          ],
        );
      }
    });
  }

  async getPassageDoc(uuid: string): Promise<PassageDocRecord | null> {
    const rows = this.#rows(
      `SELECT uuid, work_uuid, doc, checksum, version, updated_at
         FROM passage_docs WHERE uuid = ?`,
      [uuid],
    );
    if (!rows.length) return null;
    const [id, workUuid, doc, checksum, version, updatedAt] = rows[0];
    const bytes = asBytes(doc);
    if (!verifyChecksum(bytes, checksum as number)) {
      // Withheld rather than returned, exactly as for a journal entry: a
      // corrupt doc that reads as valid would be applied to the editor and
      // synced to the server. Null means "not available locally", which the
      // caller already has to handle by re-fetching.
      console.error(`lib-persistence: passage doc ${uuid} failed its checksum`);
      return null;
    }
    return {
      uuid: id as string,
      workUuid: workUuid as string,
      doc: bytes,
      version: version as number,
      updatedAt: updatedAt as number,
    };
  }

  async putSpine(record: Omit<SpineRecord, 'updatedAt'>): Promise<void> {
    this.#run(
      `INSERT INTO spine (work_uuid, doc, checksum, version, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(work_uuid) DO UPDATE SET
         doc = excluded.doc,
         checksum = excluded.checksum,
         version = excluded.version,
         updated_at = excluded.updated_at`,
      [
        record.workUuid,
        record.doc,
        crc32(record.doc),
        record.version,
        Date.now(),
      ],
    );
  }

  async getSpine(workUuid: string): Promise<SpineRecord | null> {
    const rows = this.#rows(
      `SELECT work_uuid, doc, checksum, version, updated_at
         FROM spine WHERE work_uuid = ?`,
      [workUuid],
    );
    if (!rows.length) return null;
    const [id, doc, checksum, version, updatedAt] = rows[0];
    const bytes = asBytes(doc);
    if (!verifyChecksum(bytes, checksum as number)) {
      console.error(`lib-persistence: spine ${workUuid} failed its checksum`);
      return null;
    }
    return {
      workUuid: id as string,
      doc: bytes,
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

  /**
   * Delete exactly the journal entries named, and nothing else.
   *
   * Ids rather than a high-water mark, because `journal.id` is one AUTOINCREMENT
   * sequence shared by every passage. A watermark over a shared sequence sweeps up
   * whatever else happens to sit below it: edit passage A, edit passage B, edit A
   * again, then sync A and clear through A's latest id, and B's untouched edit is
   * deleted with it. Naming the ids makes it impossible to remove an entry the
   * caller did not just sync.
   */
  #deleteJournalEntries(ids: number[]): number {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += JOURNAL_DELETE_CHUNK) {
      const chunk = ids.slice(i, i + JOURNAL_DELETE_CHUNK);
      const placeholders = chunk.map(() => '?').join(', ');
      const rows = this.#rows(
        `DELETE FROM journal WHERE id IN (${placeholders}) RETURNING id`,
        chunk,
      );
      deleted += rows.length;
    }
    return deleted;
  }

  /**
   * Drop the journal entries whose ids are given, after they have been synced.
   *
   * Returns how many rows were actually removed, which can be fewer than were
   * asked for if a previous call already covered some.
   */
  async clearJournal(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    return this.#deleteJournalEntries(ids);
  }

  async journalCount(): Promise<number> {
    const rows = this.#rows(`SELECT COUNT(*) FROM journal`);
    return rows[0][0] as number;
  }

  async putCache(record: Omit<CacheRecord, 'updatedAt'>): Promise<void> {
    this.#run(
      `INSERT INTO cache (key, body, checksum, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         body = excluded.body,
         checksum = excluded.checksum,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      [
        record.key,
        record.body,
        crc32(record.body),
        record.expiresAt,
        Date.now(),
      ],
    );
  }

  async getCache(key: string): Promise<CacheRecord | null> {
    const rows = this.#rows(
      `SELECT key, body, checksum, expires_at, updated_at
         FROM cache WHERE key = ?`,
      [key],
    );
    if (!rows.length) return null;
    const [id, body, checksum, expiresAt, updatedAt] = rows[0];
    const bytes = asBytes(body);
    if (!verifyChecksum(bytes, checksum as number)) {
      console.error(`lib-persistence: cache entry ${key} failed its checksum`);
      return null;
    }
    return {
      key: id as string,
      body: bytes,
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
   *
   * `syncedJournalIds` names the entries this doc subsumes — the ones the caller
   * read, sent, and had acknowledged. Nothing else is touched, so another
   * passage's unsynced edits cannot be caught up in the cleanup.
   */
  async commitSynced(
    record: Omit<PassageDocRecord, 'updatedAt'>,
    syncedJournalIds: number[],
  ): Promise<void> {
    const driver = this.#require();
    driver.transaction(() => {
      this.#run(
        `INSERT INTO passage_docs (uuid, work_uuid, doc, checksum, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(uuid) DO UPDATE SET
           doc = excluded.doc,
           checksum = excluded.checksum,
           version = excluded.version,
           updated_at = excluded.updated_at`,
        [
          record.uuid,
          record.workUuid,
          record.doc,
          crc32(record.doc),
          record.version,
          Date.now(),
        ],
      );
      this.#deleteJournalEntries(syncedJournalIds);
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
   * Check SQLite's own integrity, every journal checksum, and — conditionally —
   * the blob stores.
   *
   * `PRAGMA integrity_check` catches structural damage; the checksum sweeps catch
   * a payload that is structurally fine but wrong.
   *
   * The journal is always swept in full. It is bounded by how much a translator
   * has written since their last sync, and it is the one table that cannot be
   * re-fetched, so it earns the cost unconditionally.
   *
   * The blob stores are not swept by default, because they are unbounded — they
   * hold every cached work — and sweeping them means reading and CRC-ing the
   * whole database. Doing that on every open made cold-open time and peak worker
   * memory scale with total cache size, which on a 437 MB database measured
   * multiple seconds and roughly half a gigabyte of transient allocation. What
   * actually protects a blob is `getPassageDoc` / `getSpine` / `getCache`
   * verifying it on the way out, which is unaffected by any of this.
   *
   * @param blobs `'if-damaged'` (the default) sweeps blobs only when
   * `integrity_check` already reported a problem, where the extra detail helps
   * decide whether the file is salvageable. Note that this will *not* pre-empt the
   * failure mode the checksums exist for: overflow-page corruption leaves
   * `integrity_check` reporting `ok`, so a damaged blob in an otherwise sound file
   * is found on read rather than here. Use `sweepAllBlobs()` to check anyway.
   */
  async integrityCheck(
    blobs: BlobSweepMode = 'if-damaged',
  ): Promise<IntegrityReport> {
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
    const corruptBlobs: IntegrityReport['corruptBlobs'] = [];
    let blobRecordsChecked = 0;
    let blobsSwept = false;
    const sweepErrors: string[] = [];

    const describe = (error: unknown) =>
      error instanceof Error ? error.message : String(error);

    // Attempted even when `integrity_check` already failed, and wrapped rather
    // than guarded: a damaged database is precisely when the state of the journal
    // matters most, and a read that throws part-way through is itself a finding
    // rather than a reason to abandon the report.
    try {
      const journalRows = this.#rows(
        `SELECT id, update_blob, checksum FROM journal ORDER BY id ASC`,
      );
      journalEntriesChecked = journalRows.length;
      for (const [id, update, checksum] of journalRows) {
        if (!verifyChecksum(asBytes(update), checksum as number)) {
          corruptJournalIds.push(id as number);
        }
      }
    } catch (error) {
      sweepErrors.push(`journal sweep failed: ${describe(error)}`);
    }

    const sweepBlobs =
      blobs === 'always' ||
      (blobs === 'if-damaged' && databaseErrors.length > 0);

    if (sweepBlobs) {
      blobsSwept = true;

      // The blob stores need their own sweep for the same reason they need
      // checksums at all — integrity_check does not read payload bytes.
      const blobStores = [
        ['passage_docs', 'uuid', 'doc'],
        ['spine', 'work_uuid', 'doc'],
        ['cache', 'key', 'body'],
      ] as const;

      for (const [store, keyColumn, blobColumn] of blobStores) {
        try {
          const rows = this.#rows(
            `SELECT ${keyColumn}, ${blobColumn}, checksum FROM ${store}`,
          );
          blobRecordsChecked += rows.length;
          for (const [key, blob, checksum] of rows) {
            if (!verifyChecksum(asBytes(blob), checksum as number)) {
              corruptBlobs.push({ store, key: String(key) });
            }
          }
        } catch (error) {
          // One unreadable store must not hide what the others would have found.
          sweepErrors.push(`${store} sweep failed: ${describe(error)}`);
        }
      }
    }

    return {
      databaseOk: databaseErrors.length === 0,
      databaseErrors,
      corruptJournalIds,
      journalEntriesChecked,
      corruptBlobs,
      blobRecordsChecked,
      blobsSwept,
      sweepErrors,
    };
  }

  /**
   * Sweep every blob in the database against its checksum.
   *
   * The diagnostic entry point, and the only way to detect overflow-page
   * corruption before the affected record is read. Costs one full read of the
   * database, so it belongs behind a deliberate action — a support tool, a
   * "verify my offline data" button — never on the open path.
   */
  async sweepAllBlobs(): Promise<IntegrityReport> {
    return this.integrityCheck('always');
  }

  async databaseSize(): Promise<number> {
    return this.#driver ? this.#driver.size() : 0;
  }
}
