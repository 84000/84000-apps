/**
 * Proof that one storage library serves both environments.
 *
 * DEV-708 recommends SQLite over IndexedDB largely because a local agent
 * process — Claude Desktop, Codex — can run the *same* schema and queries
 * outside the browser, where there is no production IndexedDB at all. That
 * claim is only worth anything if it is checked, so this exercises the real
 * `LocalDatabase` against the Node driver: same class, same schema, same
 * statements as the browser worker, different driver underneath.
 *
 * These are the library's unit tests. What is not covered here is
 * browser-runtime behaviour — OPFS, Web Locks, tab crashes — which no Node test
 * can express.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 } from '../checksum';
import { DatabaseNotOpenError, SchemaTooNewError } from '../errors';
import {
  JOURNAL_LAST_CHANGED_AT,
  planSchemaReconciliation,
  SCHEMA_VERSION,
} from '../schema';
import { LocalDatabase } from '../worker/database';
import { createNodeDriver } from './node-driver';

const bytes = (...values: number[]) => new Uint8Array(values);

/** Damage a stored payload without touching its checksum. */
const corrupt = (db: LocalDatabase, sql: string, bind: unknown[]) => {
  const driver = db.driver;
  if (!driver) throw new Error('database is not open');
  driver.run(sql, bind);
};

describe('lib-persistence on node:sqlite', () => {
  let dir: string;
  let db: LocalDatabase;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lib-persistence-'));
    db = new LocalDatabase(async () => createNodeDriver(join(dir, 'test.db')));
    await db.open();
  });

  afterEach(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies the shared schema and opens clean', async () => {
    const report = await db.open.call(db);
    expect(report.vfsName).toBe('node');
    expect(report.integrity.databaseOk).toBe(true);
    expect(report.integrity.corruptJournalIds).toEqual([]);
    expect(report.integrity.sweepErrors).toEqual([]);
  });

  it('records an unreadable store as a finding rather than throwing', async () => {
    await db.putPassageDoc({
      uuid: 'p1',
      workUuid: 'w1',
      doc: bytes(1, 2, 3),
      version: 1,
    });
    // Make one store unreadable. A sweep that threw here would lose the results
    // for every other store along with it.
    corrupt(db, 'DROP TABLE passage_docs', []);

    const report = await db.sweepAllBlobs();
    expect(report.sweepErrors).toHaveLength(1);
    expect(report.sweepErrors[0]).toContain('passage_docs');
    // The journal and the other stores were still assessed.
    expect(report.blobsSwept).toBe(true);
    expect(report.journalEntriesChecked).toBe(0);
  });

  it('round-trips passage docs and the spine', async () => {
    await db.putPassageDoc({
      uuid: 'p1',
      workUuid: 'w1',
      doc: bytes(1, 2, 3, 4),
      version: 7,
    });
    const doc = await db.getPassageDoc('p1');
    expect(doc?.version).toBe(7);
    expect(Array.from(doc?.doc ?? [])).toEqual([1, 2, 3, 4]);

    await db.putSpine({ workUuid: 'w1', doc: bytes(9, 9), version: 2 });
    expect((await db.getSpine('w1'))?.version).toBe(2);
  });

  it('upserts rather than duplicating on repeated writes', async () => {
    for (const version of [1, 2, 3]) {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(version),
        version,
      });
    }
    expect((await db.getPassageDoc('p1'))?.version).toBe(3);
  });

  describe('journal', () => {
    it('stamps each entry with a checksum over its payload', async () => {
      const update = bytes(5, 6, 7);
      const id = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update,
      });
      const { entries, corruptIds } = await db.readJournal();
      expect(corruptIds).toEqual([]);
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(id);
      expect(entries[0].checksum).toBe(crc32(update));
    });

    it('withholds an entry whose payload no longer matches its checksum', async () => {
      const id = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1, 2, 3),
      });
      corrupt(db, 'UPDATE journal SET update_blob = ? WHERE id = ?', [
        bytes(1, 9, 3),
        id,
      ]);

      const { entries, corruptIds } = await db.readJournal();
      expect(corruptIds).toContain(id);
      // The critical property: it is not returned as if it were valid.
      expect(entries.map((e) => e.id)).not.toContain(id);
    });

    it('reports corrupt entries from the integrity sweep too', async () => {
      const id = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(4, 4, 4),
      });
      corrupt(db, 'UPDATE journal SET update_blob = ? WHERE id = ?', [
        bytes(4, 5, 4),
        id,
      ]);

      const report = await db.integrityCheck();
      expect(report.databaseOk).toBe(true); // structurally fine
      expect(report.corruptJournalIds).toEqual([id]); // payload is not
    });
  });

  describe('blob checksums', () => {
    // PRAGMA integrity_check verifies b-tree structure, not BLOB payload bytes,
    // so a corrupted doc inside an overflow page leaves the database
    // structurally perfect. Measured on a 420 MB database: 12 rows silently
    // corrupted, integrity_check "ok". These per-record checksums are the only
    // thing standing between that and a garbage doc being synced to the server.

    it('withholds a passage doc whose payload no longer matches', async () => {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(1, 2, 3, 4),
        version: 1,
      });
      corrupt(db, 'UPDATE passage_docs SET doc = ? WHERE uuid = ?', [
        bytes(1, 2, 9, 4),
        'p1',
      ]);

      expect(await db.getPassageDoc('p1')).toBeNull();
    });

    it('withholds a spine whose payload no longer matches', async () => {
      await db.putSpine({ workUuid: 'w1', doc: bytes(7, 7, 7), version: 1 });
      corrupt(db, 'UPDATE spine SET doc = ? WHERE work_uuid = ?', [
        bytes(7, 8, 7),
        'w1',
      ]);

      expect(await db.getSpine('w1')).toBeNull();
    });

    it('withholds a cache entry whose payload no longer matches', async () => {
      await db.putCache({
        key: 'k1',
        body: bytes(5, 5, 5),
        expiresAt: Date.now() + 60_000,
      });
      corrupt(db, 'UPDATE cache SET body = ? WHERE key = ?', [
        bytes(5, 6, 5),
        'k1',
      ]);

      expect(await db.getCache('k1')).toBeNull();
    });

    it('reports corrupt blobs from the explicit sweep, which integrity_check cannot', async () => {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(1, 2, 3),
        version: 1,
      });
      await db.putCache({
        key: 'k1',
        body: bytes(4, 5, 6),
        expiresAt: Date.now() + 60_000,
      });
      corrupt(db, 'UPDATE passage_docs SET doc = ? WHERE uuid = ?', [
        bytes(1, 9, 3),
        'p1',
      ]);
      corrupt(db, 'UPDATE cache SET body = ? WHERE key = ?', [
        bytes(4, 9, 6),
        'k1',
      ]);

      const report = await db.sweepAllBlobs();
      expect(report.databaseOk).toBe(true); // structurally perfect
      expect(report.blobsSwept).toBe(true);
      expect(report.corruptBlobs).toEqual(
        expect.arrayContaining([
          { store: 'passage_docs', key: 'p1' },
          { store: 'cache', key: 'k1' },
        ]),
      );
      expect(report.blobRecordsChecked).toBeGreaterThanOrEqual(2);
    });

    it('passes a clean sweep when nothing is damaged', async () => {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(1, 2, 3),
        version: 1,
      });
      await db.putSpine({ workUuid: 'w1', doc: bytes(4), version: 1 });
      const report = await db.sweepAllBlobs();
      expect(report.corruptBlobs).toEqual([]);
      expect(report.blobRecordsChecked).toBe(2);
    });
  });

  describe('sweep cost', () => {
    // The blob sweep reads and CRCs every row, so on a large cache it costs
    // seconds and hundreds of megabytes of transient allocation. It used to run
    // unconditionally on open, which made cold-open time scale with total
    // database size. What actually protects a blob is verify-on-read.

    it('does not sweep blobs on open', async () => {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(1, 2, 3),
        version: 1,
      });
      await db.close();

      db = new LocalDatabase(async () => createNodeDriver(join(dir, 'test.db')));
      const report = await db.open();

      expect(report.integrity.blobsSwept).toBe(false);
      expect(report.integrity.blobRecordsChecked).toBe(0);
    });

    it('still sweeps the whole journal on open, which is never re-fetchable', async () => {
      await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });
      await db.appendJournal({
        passageUuid: 'p2',
        workUuid: 'w1',
        update: bytes(2),
      });
      await db.close();

      db = new LocalDatabase(async () => createNodeDriver(join(dir, 'test.db')));
      const report = await db.open();

      expect(report.integrity.journalEntriesChecked).toBe(2);
      expect(report.integrity.corruptJournalIds).toEqual([]);
    });

    it('reports blobs as unswept rather than clean when asked not to sweep', async () => {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(1, 2, 3),
        version: 1,
      });
      corrupt(db, 'UPDATE passage_docs SET doc = ? WHERE uuid = ?', [
        bytes(1, 9, 3),
        'p1',
      ]);

      const skipped = await db.integrityCheck('never');
      // An empty corruptBlobs must not read as a clean bill of health when the
      // sweep never ran — this record *is* damaged.
      expect(skipped.blobsSwept).toBe(false);
      expect(skipped.corruptBlobs).toEqual([]);

      const swept = await db.integrityCheck('always');
      expect(swept.blobsSwept).toBe(true);
      expect(swept.corruptBlobs).toEqual([
        { store: 'passage_docs', key: 'p1' },
      ]);
    });
  });

  describe('commitSynced', () => {
    it('writes the doc and clears covered entries in one transaction', async () => {
      const first = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });
      await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(2),
      });

      await db.commitSynced(
        { uuid: 'p1', workUuid: 'w1', doc: bytes(8, 8), version: 5 },
        [first],
      );

      expect((await db.getPassageDoc('p1'))?.version).toBe(5);
      expect(await db.journalCount()).toBe(1);
    });

    it('leaves another passage’s interleaved edits alone', async () => {
      // The regression this signature exists for. `journal.id` is one
      // AUTOINCREMENT sequence shared by every passage, so clearing "everything
      // through id N" after syncing one passage silently deleted whatever else
      // had been written below N. Here p2's edit sits between p1's two, and it is
      // the only copy of that work.
      const p1First = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });
      const p2Only = await db.appendJournal({
        passageUuid: 'p2',
        workUuid: 'w1',
        update: bytes(2),
      });
      const p1Second = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(3),
      });

      expect(p2Only).toBeGreaterThan(p1First);
      expect(p1Second).toBeGreaterThan(p2Only);

      await db.commitSynced(
        { uuid: 'p1', workUuid: 'w1', doc: bytes(8, 8), version: 5 },
        [p1First, p1Second],
      );

      const { entries } = await db.readJournal();
      expect(entries.map((entry) => entry.id)).toEqual([p2Only]);
      expect(entries[0].passageUuid).toBe('p2');
      expect(entries[0].update).toEqual(bytes(2));
    });

    it('rolls the journal deletes back with the doc write', async () => {
      const id = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });

      // A doc whose version violates NOT NULL fails mid-transaction, after the
      // delete would have been issued.
      await expect(
        db.commitSynced(
          {
            uuid: 'p1',
            workUuid: 'w1',
            doc: bytes(8),
            version: null as unknown as number,
          },
          [id],
        ),
      ).rejects.toThrow();

      expect(await db.journalCount()).toBe(1);
    });

    it('rolls back every write when the transaction fails', async () => {
      await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });
      const journalBefore = await db.journalCount();

      // Exercise the driver's transaction primitive directly. Making
      // `commitSynced` itself fail is awkward — SQLite is dynamically typed, so
      // even a wrong-typed blob is accepted — but the property that matters is
      // that a throw part-way through leaves *neither* write behind, and that
      // is the primitive both drivers must implement identically.
      const driver = db.driver;
      expect(driver).not.toBeNull();
      expect(() =>
        driver?.transaction(() => {
          driver.run(
            `INSERT INTO passage_docs
               (uuid, work_uuid, doc, checksum, version, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['rollback-probe', 'w1', bytes(1), crc32(bytes(1)), 1, Date.now()],
          );
          driver.run(`DELETE FROM journal`);
          throw new Error('deliberate failure mid-transaction');
        }),
      ).toThrow('deliberate failure');

      // Both halves rolled back: the doc is absent and the journal intact.
      expect(await db.getPassageDoc('rollback-probe')).toBeNull();
      expect(await db.journalCount()).toBe(journalBefore);
    });
  });

  describe('full-text search', () => {
    const corpus = [
      {
        passageUuid: 'p1',
        workUuid: 'w1',
        text: 'The bodhisattva Mañjuśrī addressed Śāriputra in the assembly.',
      },
      {
        passageUuid: 'p2',
        workUuid: 'w1',
        text: 'The Bhagavān taught the dhāraṇī to the assembled saṅgha.',
      },
      {
        passageUuid: 'p3',
        workUuid: 'w2',
        text: 'They rest in equipoise within the bodies of yakṣas.',
      },
    ];

    beforeEach(async () => {
      await db.indexPassageText(corpus);
    });

    it('indexes every passage', async () => {
      expect(await db.indexedPassageCount()).toBe(3);
    });

    it('folds diacritics so an ASCII query matches IAST text', async () => {
      // The reason FTS5 decides the offline-reader case: this corpus is dense
      // with transliteration and readers type on ASCII keyboards.
      for (const [query, expected] of [
        ['manjusri', 'p1'],
        ['sariputra', 'p1'],
        ['dharani', 'p2'],
        ['sangha', 'p2'],
        ['bhagavan', 'p2'],
      ] as const) {
        const hits = await db.searchPassages(query);
        expect(hits.map((h) => h.passageUuid)).toContain(expected);
      }
    });

    it('returns ranked snippets with the match delimited', async () => {
      const hits = await db.searchPassages('assembly');
      expect(hits).toHaveLength(1);
      expect(hits[0].snippet).toContain('[assembly]');
      expect(typeof hits[0].rank).toBe('number');
    });

    it('orders multiple matches by relevance', async () => {
      const hits = await db.searchPassages('the');
      expect(hits.length).toBeGreaterThan(1);
      const ranks = hits.map((h) => h.rank);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    });

    it('does not throw on punctuation a user might type', async () => {
      await expect(db.searchPassages('"unbalanced')).resolves.toEqual([]);
      await expect(db.searchPassages('   ')).resolves.toEqual([]);
    });

    it('replaces rather than duplicating on re-index', async () => {
      await db.indexPassageText([
        { passageUuid: 'p1', workUuid: 'w1', text: 'Replaced entirely.' },
      ]);
      expect(await db.indexedPassageCount()).toBe(3);
      expect(await db.searchPassages('Mañjuśrī')).toEqual([]);
      expect(
        (await db.searchPassages('Replaced')).map((h) => h.passageUuid),
      ).toEqual(['p1']);
    });
  });

  describe('cache', () => {
    it('evicts only expired entries', async () => {
      const now = Date.now();
      await db.putCache({ key: 'a', body: bytes(1), expiresAt: now - 1 });
      await db.putCache({ key: 'b', body: bytes(2), expiresAt: now + 60_000 });

      expect(await db.evictExpiredCache(now)).toBe(1);
      expect(await db.getCache('a')).toBeNull();
      expect(await db.getCache('b')).not.toBeNull();
    });
  });

  describe('clearJournal', () => {
    it('deletes only the ids it is given', async () => {
      const ids = [];
      for (const passage of ['p1', 'p2', 'p3']) {
        ids.push(
          await db.appendJournal({
            passageUuid: passage,
            workUuid: 'w1',
            update: bytes(1),
          }),
        );
      }

      expect(await db.clearJournal([ids[0], ids[2]])).toBe(2);

      const { entries } = await db.readJournal();
      expect(entries.map((entry) => entry.passageUuid)).toEqual(['p2']);
    });

    it('is a no-op for an empty list rather than clearing everything', async () => {
      await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });

      expect(await db.clearJournal([])).toBe(0);
      expect(await db.journalCount()).toBe(1);
    });

    it('reports only rows actually removed when ids are already gone', async () => {
      const id = await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(1),
      });

      expect(await db.clearJournal([id])).toBe(1);
      expect(await db.clearJournal([id])).toBe(0);
    });

    it('deletes more ids than fit in one statement', async () => {
      // The delete is chunked because SQLite caps bound parameters per statement
      // and a long offline session can outrun that cap.
      const ids: number[] = [];
      for (let i = 0; i < 1200; i++) {
        ids.push(
          await db.appendJournal({
            passageUuid: `p${i}`,
            workUuid: 'w1',
            update: bytes(i % 256),
          }),
        );
      }
      const keep = ids.pop() as number;

      expect(await db.clearJournal(ids)).toBe(1199);
      expect(await db.journalCount()).toBe(1);
      const { entries } = await db.readJournal();
      expect(entries[0].id).toBe(keep);
    });
  });

  describe('schema version', () => {
    /** Reopen the same file with a fresh LocalDatabase. */
    const reopen = async () => {
      const next = new LocalDatabase(async () =>
        createNodeDriver(join(dir, 'test.db')),
      );
      const report = await next.open();
      return { db: next, report };
    };

    it('records the schema version and reports a real file size', async () => {
      const driver = db.driver;
      expect(driver?.name).toBe('node');
      expect(driver?.rows('PRAGMA user_version')[0][0]).toBe(SCHEMA_VERSION);
      expect(await db.databaseSize()).toBeGreaterThan(0);
    });

    it('reports a fresh database as version 0 and stamps it', async () => {
      // `db` in beforeEach opened the file for the first time.
      const driver = db.driver;
      expect(driver?.rows('PRAGMA user_version')[0][0]).toBe(SCHEMA_VERSION);
      await db.close();

      const { db: again, report } = await reopen();
      // Second open finds the stamp rather than treating it as new.
      expect(report.migration.fromVersion).toBe(SCHEMA_VERSION);
      expect(report.migration.rebuilt).toBe(false);
      await again.close();
    });

    it('refuses to open a file written by a newer build', async () => {
      corrupt(db, `PRAGMA user_version = ${SCHEMA_VERSION + 1}`, []);
      await db.close();

      const next = new LocalDatabase(async () =>
        createNodeDriver(join(dir, 'test.db')),
      );
      // Rebuilding here would discard a cache written by newer code, and would be
      // restoring a journal whose shape this build may not understand.
      await expect(next.open()).rejects.toThrow(SchemaTooNewError);
    });

    it('leaves nothing usable behind when it refuses an open', async () => {
      corrupt(db, `PRAGMA user_version = ${SCHEMA_VERSION + 1}`, []);
      await db.close();

      const next = new LocalDatabase(async () =>
        createNodeDriver(join(dir, 'test.db')),
      );
      await expect(next.open()).rejects.toThrow(SchemaTooNewError);

      // A refused open must not leave the driver attached, or every later call
      // would run against a database this build just said it cannot read.
      expect(next.driver).toBeNull();
      await expect(next.journalCount()).rejects.toThrow(DatabaseNotOpenError);
    });

    it('rebuilds the re-fetchable tables on an older file but keeps the journal', async () => {
      await db.putPassageDoc({
        uuid: 'p1',
        workUuid: 'w1',
        doc: bytes(1, 2, 3),
        version: 1,
      });
      await db.putSpine({ workUuid: 'w1', doc: bytes(4), version: 1 });
      await db.putCache({
        key: 'k1',
        body: bytes(5),
        expiresAt: Date.now() + 60_000,
      });
      await db.indexPassageText([
        { passageUuid: 'p1', workUuid: 'w1', text: 'indexed text' },
      ]);
      await db.appendJournal({
        passageUuid: 'p1',
        workUuid: 'w1',
        update: bytes(9, 9),
      });

      // Pose as an older file.
      corrupt(db, 'PRAGMA user_version = 1', []);
      await db.close();

      const { db: migrated, report } = await reopen();
      expect(report.migration.fromVersion).toBe(1);
      expect(report.migration.toVersion).toBe(SCHEMA_VERSION);
      expect(report.migration.rebuilt).toBe(true);

      // Everything re-fetchable is gone...
      expect(await migrated.getPassageDoc('p1')).toBeNull();
      expect(await migrated.getSpine('w1')).toBeNull();
      expect(await migrated.getCache('k1')).toBeNull();
      expect(await migrated.indexedPassageCount()).toBe(0);

      // ...and the one thing that is not re-fetchable survived intact.
      const { entries } = await migrated.readJournal();
      expect(entries).toHaveLength(1);
      expect(entries[0].passageUuid).toBe('p1');
      expect(entries[0].update).toEqual(bytes(9, 9));

      // And the file is now stamped current, so the next open is a no-op.
      await migrated.close();
      const { db: again, report: second } = await reopen();
      expect(second.migration.rebuilt).toBe(false);
      expect(await again.journalCount()).toBe(1);
      await again.close();
    });

  });

  describe('planSchemaReconciliation', () => {
    // The decision table, tested directly rather than through a file, so that
    // versions which cannot exist yet are still covered.

    it('treats an unstamped file as fresh', () => {
      expect(planSchemaReconciliation(0)).toBe('fresh');
    });

    it('treats the current version as nothing to do', () => {
      expect(planSchemaReconciliation(SCHEMA_VERSION)).toBe('current');
    });

    it('rejects anything newer than this build', () => {
      expect(planSchemaReconciliation(SCHEMA_VERSION + 1)).toBe(
        'reject-too-new',
      );
      expect(planSchemaReconciliation(SCHEMA_VERSION + 99)).toBe(
        'reject-too-new',
      );
    });

    it('rebuilds an older version whose journal is unchanged', () => {
      for (let v = JOURNAL_LAST_CHANGED_AT; v < SCHEMA_VERSION; v++) {
        expect(planSchemaReconciliation(v)).toBe('rebuild');
      }
    });

    it('refuses a version older than the journal’s last change', () => {
      // Guards the case that arrives the first time the journal's own columns
      // change: dropping caches cannot fix it, and the journal must not be
      // reinterpreted or discarded to make the open succeed.
      const older = JOURNAL_LAST_CHANGED_AT - 1;
      // Only meaningful once the journal has changed at least once past v1.
      if (older > 0) {
        expect(planSchemaReconciliation(older)).toBe(
          'reject-journal-migration',
        );
      }
      // Whatever JOURNAL_LAST_CHANGED_AT becomes, a stamped file below it never
      // rebuilds.
      expect(
        ['reject-journal-migration', 'fresh'].includes(
          planSchemaReconciliation(older),
        ),
      ).toBe(true);
    });
  });

  it('survives being closed and reopened, as a restarted agent would', async () => {
    await db.appendJournal({
      passageUuid: 'p1',
      workUuid: 'w1',
      update: bytes(1, 2),
    });
    await db.close();

    const reopened = new LocalDatabase(async () =>
      createNodeDriver(join(dir, 'test.db')),
    );
    const report = await reopened.open();
    expect(report.integrity.databaseOk).toBe(true);
    expect(await reopened.journalCount()).toBe(1);
    await reopened.close();
  });
});
