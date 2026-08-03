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
 * These are also the library's first unit tests. Everything else about the
 * stack is a browser-runtime fact that only the torture harness can reach.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 } from '../checksum';
import { SCHEMA_VERSION } from '../schema';
import { LocalDatabase } from '../worker/database';
import { createNodeDriver } from './node-driver';

const bytes = (...values: number[]) => new Uint8Array(values);

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
      // Same corruption the browser harness injects: change the payload,
      // leave the stored checksum alone.
      await db.corruptJournalEntry(id, bytes(1, 9, 3));

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
      await db.corruptJournalEntry(id, bytes(4, 5, 4));

      const report = await db.integrityCheck();
      expect(report.databaseOk).toBe(true); // structurally fine
      expect(report.corruptJournalIds).toEqual([id]); // payload is not
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
        first,
      );

      expect((await db.getPassageDoc('p1'))?.version).toBe(5);
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
            `INSERT INTO passage_docs (uuid, work_uuid, doc, version, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            ['rollback-probe', 'w1', bytes(1), 1, Date.now()],
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

  it('records the schema version and reports a real file size', async () => {
    const driver = db.driver;
    expect(driver?.name).toBe('node');
    expect(driver?.rows('PRAGMA user_version')[0][0]).toBe(SCHEMA_VERSION);
    expect(await db.databaseSize()).toBeGreaterThan(0);
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
