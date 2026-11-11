/**
 * @jest-environment node
 */
// DEV-880 acceptance, live: criteria 7 (a shared name stays put), 8 (entries
// never share rows), 9 (removing a name), 13 (unused rows stay), and linking
// an existing `names` row. Skipped unless DEV880_LIVE=1 (see live-fixture.ts).
import { saveGlossaryEntries, type DataClient } from '../../../index';
import {
  LIVE,
  Scratch,
  edgesTo,
  editName,
  expectRefusal,
  expectSuccess,
  integrity,
  interceptApply,
  liveEnv,
  makeEntry,
  nameOf,
  nameRow,
  nm,
  readEntry,
  saveChange,
  serviceClient,
  snapshot,
  storedEntryRows,
  glossaryRows,
  uid,
} from './live-fixture';

const describeLive = LIVE ? describe : describe.skip;

describeLive('DEV-880 live: names and rows (criteria 7, 8, 9, 13)', () => {
  let db: DataClient;
  let s: Scratch;
  let workA: string;
  let workB: string;
  let authA: string;
  let authB: string;

  beforeAll(async () => {
    db = serviceClient(liveEnv());
    s = new Scratch(db);
    workA = await s.work();
    workB = await s.work();
    authA = await s.authority();
    authB = await s.authority();
  });

  afterAll(async () => {
    await s?.cleanup();
  });

  /** An entry in `work` whose root name reuses an existing `names` row. */
  const sharer = (
    work: string,
    authority: string,
    nameUuid: string,
    content: string,
  ) =>
    makeEntry(db, {
      workUuid: work,
      authorityUuid: authority,
      names: [nm.en(content, { nameUuid })],
    });

  describe('7. a shared name stays put', () => {
    it('another entry in another work reads the same, and this entry gets a new names row', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('shared term'), nm.en('keep me')],
      });
      const shared = e1.names[0].nameUuid;
      const e2 = await sharer(workB, authA, shared, 'shared term');
      expect(e2.names[0].nameUuid).toBe(shared);
      const e2Before = await readEntry(db, workB, e2.uuid);
      const e2Rows = await storedEntryRows(db, e2.uuid);

      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: editName(e1.names, e1.uuid, { content: 'changed term' }),
        }),
      );

      const after = result.entries[0];
      expect(after.names[0].content).toBe('changed term');
      expect(after.names[0].nameUuid).not.toBe(shared);
      expect(after.names[0].nameAuthorityUuid).toBe(authA);
      expect(nameOf(after, 'keep me').nameUuid).toBe(e1.names[1].nameUuid);
      expect(result.changes.names).toEqual({ inserted: 1, updated: 0 });

      // The shared names row is as it was, and the other entry reads the same.
      expect(await nameRow(db, shared)).toMatchObject({
        content: 'shared term',
      });
      expect(await readEntry(db, workB, e2.uuid)).toEqual(e2Before);
      expect(await storedEntryRows(db, e2.uuid)).toEqual(e2Rows);
      expect(await readEntry(db, workA, e1.uuid)).toEqual(after);
      expect(await integrity(s)).toEqual([]);
    });

    it('another entry in the same work reads the same', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('same work shared')],
      });
      const e2 = await sharer(
        workA,
        authA,
        e1.names[0].nameUuid,
        'same work shared',
      );
      const e2Before = await readEntry(db, workA, e2.uuid);
      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: editName(e1.names, e1.uuid, { content: 'same work changed' }),
        }),
      );
      expect(result.entries[0].names[0].nameUuid).not.toBe(
        e1.names[0].nameUuid,
      );
      expect(await readEntry(db, workA, e2.uuid)).toEqual(e2Before);
      expect(await nameRow(db, e1.names[0].nameUuid)).toMatchObject({
        content: 'same work shared',
      });
    });

    it('a creators row pointing at the name reads the same', async () => {
      const creatorName = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'Translator Name',
      });
      const creator = await s.creator({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: creatorName,
      });
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [
          nm.en('root'),
          nm.en('Translator Name', { nameUuid: creatorName }),
        ],
      });
      const creatorsBefore = (await snapshot(s)).creators;
      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: editName(e1.names, e1.names[1].glossaryUuid, {
            content: 'Translator Renamed',
          }),
        }),
      );
      const renamed = nameOf(result.entries[0], 'Translator Renamed');
      expect(renamed.nameUuid).not.toBe(creatorName);
      expect(await nameRow(db, creatorName)).toMatchObject({
        content: 'Translator Name',
      });
      const after = await snapshot(s);
      expect(after.creators).toEqual(creatorsBefore);
      expect(after.creators.find((c) => c['uuid'] === creator)).toMatchObject({
        name_uuid: creatorName,
      });
    });

    it('a name the entry itself uses on two rows is not edited in place', async () => {
      const n = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'Tara',
      });
      const root = await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n,
        termType: 'translationMain',
        attestation: 'attestedSource',
      });
      const child = await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n,
        rootUuid: root,
        attestation: 'attestedDictionary',
      });
      const before = await readEntry(db, workA, root);
      expect(before.names.map((x) => x.nameUuid)).toEqual([n, n]);

      const result = expectSuccess(
        await saveChange(db, workA, before, {
          names: editName(before.names, child, { content: 'Tārā' }),
        }),
      );
      const [r, c] = result.entries[0].names;
      expect(r).toMatchObject({
        glossaryUuid: root,
        nameUuid: n,
        content: 'Tara',
      });
      expect(c).toMatchObject({
        glossaryUuid: child,
        content: 'Tārā',
        attestation: 'attestedDictionary',
      });
      expect(c.nameUuid).not.toBe(n);
      expect(await nameRow(db, n)).toMatchObject({ content: 'Tara' });
    });

    it('a name only this entry uses is edited in place (same names row)', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('private root'), nm.bo('sems', 'སེམས')],
      });
      const bo = e.names[1];
      const before = await snapshot(s);
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          names: editName(e.names, bo.glossaryUuid, {
            content: 'sems pa',
            contentTransformed: 'སེམས་པ',
          }),
        }),
      );
      const after = result.entries[0].names[1];
      expect(after).toMatchObject({
        glossaryUuid: bo.glossaryUuid,
        nameUuid: bo.nameUuid,
        content: 'sems pa',
        contentTransformed: 'སེམས་པ',
      });
      expect(result.changes.names).toEqual({ inserted: 0, updated: 1 });
      const now = await snapshot(s);
      expect(now.names.length).toBe(before.names.length);
      expect(await nameRow(db, bo.nameUuid)).toMatchObject({
        content: 'sems pa',
        content_transformed: 'སེམས་པ',
      });
    });

    it("changing a name's language gives a shared name a new row too", async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('lang shared')],
      });
      const e2 = await sharer(
        workB,
        authA,
        e1.names[0].nameUuid,
        'lang shared',
      );
      const e2Before = await readEntry(db, workB, e2.uuid);
      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: editName(e1.names, e1.uuid, { language: 'Sa-Ltn' }),
        }),
      );
      expect(result.entries[0].names[0]).toMatchObject({ language: 'Sa-Ltn' });
      expect(result.entries[0].names[0].nameUuid).not.toBe(
        e1.names[0].nameUuid,
      );
      expect(await readEntry(db, workB, e2.uuid)).toEqual(e2Before);
    });

    it("the new names row copies the old one's internal flag", async () => {
      const n = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'internal thing',
        internal: true,
      });
      const e1 = await sharer(workA, authA, n, 'internal thing');
      await sharer(workB, authA, n, 'internal thing');
      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: editName(e1.names, e1.uuid, { content: 'internal thing 2' }),
        }),
      );
      const copy = result.entries[0].names[0].nameUuid;
      expect(copy).not.toBe(n);
      expect(await nameRow(db, copy)).toMatchObject({ internal: true });
    });

    it('changing only attestation or term type never touches the names row, shared or not', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('attest root'), nm.en('attest child')],
      });
      const e2 = await sharer(
        workB,
        authA,
        e1.names[1].nameUuid,
        'attest child',
      );
      const e2Before = await readEntry(db, workB, e2.uuid);
      const namesBefore = (await snapshot(s)).names;
      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: e1.names.map((n) => ({
            ...n,
            attestation: 'attestedOther',
            termType: 'translationAlternative',
          })),
        }),
      );
      expect(result.entries[0].names.map((n) => n.nameUuid)).toEqual(
        e1.names.map((n) => n.nameUuid),
      );
      expect(
        result.entries[0].names.every((n) => n.attestation === 'attestedOther'),
      ).toBe(true);
      expect(result.changes.names).toEqual({ inserted: 0, updated: 0 });
      expect((await snapshot(s)).names).toEqual(namesBefore);
      expect(await readEntry(db, workB, e2.uuid)).toEqual(e2Before);
    });

    it('a link to the name that lands between the read and the save is not lost to an in-place edit', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('racy root'), nm.en('racy child')],
      });
      const n = e1.names[1].nameUuid;
      const { client } = interceptApply(db, async () => {
        // Another entry, in another work, links the name after the plan read it as unshared.
        await s.row({ workUuid: workB, authorityUuid: authA, nameUuid: n });
      });
      const result = expectSuccess(
        await saveChange(client, workA, e1, {
          names: editName(e1.names, e1.names[1].glossaryUuid, {
            content: 'racy child 2',
          }),
        }),
      );
      const changed = result.entries[0].names[1];
      expect(changed.content).toBe('racy child 2');
      expect(changed.nameUuid).not.toBe(n);
      expect(await nameRow(db, n)).toMatchObject({ content: 'racy child' });
      const { data } = await db
        .from('glossaries')
        .select('uuid')
        .eq('name_uuid', n);
      expect((data ?? []).length).toBe(1);
    });
  });

  describe('8. entries never share rows', () => {
    it('after adding, removing and replacing names, every row has one entry and the others are unchanged', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('e1 root'), nm.en('e1 a'), nm.en('e1 b')],
      });
      const e2 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('e2 root'), nm.en('e2 a')],
      });
      const e3 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [
          nm.en('e3 root', { nameUuid: e1.names[1].nameUuid, content: 'e1 a' }),
        ],
      });
      const others = async () => ({
        e2: [
          await readEntry(db, workA, e2.uuid),
          await storedEntryRows(db, e2.uuid),
        ],
        e3: [
          await readEntry(db, workA, e3.uuid),
          await storedEntryRows(db, e3.uuid),
        ],
      });
      const othersBefore = await others();

      let current = e1;
      current = expectSuccess(
        await saveChange(db, workA, current, {
          names: [...current.names, nm.en('e1 c'), nm.sa('e1 d')],
        }),
      ).entries[0];
      expect(await integrity(s)).toEqual([]);
      current = expectSuccess(
        await saveChange(db, workA, current, {
          names: current.names.filter((n) => n.content !== 'e1 a'),
        }),
      ).entries[0];
      expect(await integrity(s)).toEqual([]);
      current = expectSuccess(
        await saveChange(db, workA, current, {
          names: [
            ...current.names.filter((n) => n.content !== 'e1 b'),
            nm.en('e1 replacement'),
          ],
          definition: 'Defined.',
        }),
      ).entries[0];
      expect(await integrity(s)).toEqual([]);
      expect(await others()).toEqual(othersBefore);

      const { rows } = await storedEntryRows(db, e1.uuid);
      expect(rows.map((r) => r['uuid']).sort()).toEqual(
        current.names.map((n) => n.glossaryUuid).sort(),
      );
    });

    it('a name element whose glossaryUuid is a row of another entry is invalid', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('mine'), nm.en('mine too')],
      });
      const e2 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('theirs'), nm.en('theirs too')],
      });
      const before = await snapshot(s);
      for (const row of [e2.names[0], e2.names[1]]) {
        const result = await saveChange(db, workA, e1, {
          names: [
            ...e1.names,
            { ...nm.en(row.content), glossaryUuid: row.glossaryUuid },
          ],
        });
        expectRefusal(
          result,
          'invalid',
          `names[${e1.names.length}].glossaryUuid`,
        );
      }
      expect(await snapshot(s)).toEqual(before);
    });

    it('a name element whose glossaryUuid is a row of another work is invalid', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('here')],
      });
      const elsewhere = await makeEntry(db, {
        workUuid: workB,
        authorityUuid: authA,
        names: [nm.en('there'), nm.en('there too')],
      });
      const before = await snapshot(s);
      const result = await saveChange(db, workA, e1, {
        names: [
          ...e1.names,
          {
            ...nm.en('there too'),
            glossaryUuid: elsewhere.names[1].glossaryUuid,
          },
        ],
      });
      expectRefusal(result, 'invalid', 'names[1].glossaryUuid');
      expect(await snapshot(s)).toEqual(before);
    });

    it('moving a row between two entries in one call is refused, writing nothing', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('from root'), nm.en('travelling')],
      });
      const e2 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('to root')],
      });
      const traveller = e1.names[1];
      const before = await snapshot(s);
      const result = await saveGlossaryEntries({
        client: db,
        workUuid: workA,
        saves: [
          {
            uuid: e1.uuid,
            change: { names: [e1.names[0]] },
            expect: { names: e1.names },
          },
          {
            uuid: e2.uuid,
            change: { names: [...e2.names, traveller] },
            expect: { names: e2.names },
          },
        ],
      });
      expectRefusal(result, 'invalid');
      expect(await snapshot(s)).toEqual(before);
    });

    it('a glossaryUuid that is no row anywhere is a new row with that uuid', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('has new row')],
      });
      const rowUuid = uid();
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          names: [...e.names, { ...nm.en('new row'), glossaryUuid: rowUuid }],
        }),
      );
      expect(result.entries[0].names[1].glossaryUuid).toBe(rowUuid);
      expect(
        (await edgesTo(db, [rowUuid])).map((r) => r['parent_uuid']),
      ).toEqual([e.uuid]);
      expect(await integrity(s)).toEqual([]);
    });
  });

  describe('9. removing a name', () => {
    it("removes this entry's row and edge, and leaves other entries alone (13: the names row stays)", async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('rm root'), nm.en('rm a'), nm.en('rm b')],
      });
      const e2 = await sharer(workB, authA, e1.names[1].nameUuid, 'rm a');
      const e2Before = await readEntry(db, workB, e2.uuid);
      const e2Rows = await storedEntryRows(db, e2.uuid);
      const removed = e1.names[1];

      const result = expectSuccess(
        await saveChange(db, workA, e1, {
          names: e1.names.filter(
            (n) => n.glossaryUuid !== removed.glossaryUuid,
          ),
        }),
      );
      expect(result.entries[0].names.map((n) => n.content)).toEqual([
        'rm root',
        'rm b',
      ]);
      expect(result.changes.glossaries.deleted).toBe(1);
      expect(result.changes.glossaryEdges.deleted).toBe(1);

      expect(await glossaryRows(db, [removed.glossaryUuid])).toEqual([]);
      expect(await edgesTo(db, [removed.glossaryUuid])).toEqual([]);
      const stored = await storedEntryRows(db, e1.uuid);
      expect(stored.rows).toHaveLength(2);
      expect(stored.edges).toHaveLength(2);

      // 13. The names row is left, still used by the other entry.
      expect(await nameRow(db, removed.nameUuid)).toMatchObject({
        content: 'rm a',
      });
      expect(await readEntry(db, workB, e2.uuid)).toEqual(e2Before);
      expect(await storedEntryRows(db, e2.uuid)).toEqual(e2Rows);
      expect(await integrity(s)).toEqual([]);
    });

    it('13. a names row left with no user is not deleted', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('orphaning root'), nm.en('soon unused')],
      });
      const unused = e.names[1].nameUuid;
      expectSuccess(await saveChange(db, workA, e, { names: [e.names[0]] }));
      const { data } = await db
        .from('glossaries')
        .select('uuid')
        .eq('name_uuid', unused);
      expect(data).toEqual([]);
      expect(await nameRow(db, unused)).toMatchObject({
        content: 'soon unused',
      });
    });

    it('removing a name that another entry shares leaves that entry as it was', async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('sh root'), nm.en('sh gone')],
      });
      const e2 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [
          nm.en('sh other root'),
          nm.en('sh gone', { nameUuid: e1.names[1].nameUuid }),
        ],
      });
      const e2Before = await readEntry(db, workA, e2.uuid);
      const e2Rows = await storedEntryRows(db, e2.uuid);
      expectSuccess(await saveChange(db, workA, e1, { names: [e1.names[0]] }));
      expect(await readEntry(db, workA, e2.uuid)).toEqual(e2Before);
      expect(await storedEntryRows(db, e2.uuid)).toEqual(e2Rows);
    });

    it('the root name cannot be removed', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('keep root'), nm.en('other')],
      });
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, e, { names: [e.names[1]] }),
        'invalid',
        'names',
      );
      expectRefusal(
        await saveChange(db, workA, e, { names: [] }),
        'invalid',
        'names',
      );
      expect(await snapshot(s)).toEqual(before);
    });
  });

  describe('linking an existing names row', () => {
    it('re-points a row at another names row of the authority, leaving the old one (13)', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('link root'), nm.en('link old')],
      });
      const target = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'link target',
      });
      const old = e.names[1].nameUuid;
      const targetBefore = await nameRow(db, target);
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          names: editName(e.names, e.names[1].glossaryUuid, {
            nameUuid: target,
            content: 'link target',
          }),
        }),
      );
      expect(result.entries[0].names[1]).toMatchObject({
        glossaryUuid: e.names[1].glossaryUuid,
        nameUuid: target,
        content: 'link target',
      });
      expect(result.changes.names).toEqual({ inserted: 0, updated: 0 });
      expect(await nameRow(db, target)).toEqual(targetBefore);
      expect(await nameRow(db, old)).toMatchObject({ content: 'link old' });
    });

    it('adds a new row that links an existing names row without copying it', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('link add root')],
      });
      const target = await s.name({
        authorityUuid: authA,
        language: 'Sa-Ltn',
        content: 'prajñā',
      });
      const namesBefore = (await snapshot(s)).names.length;
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          names: [...e.names, nm.sa('prajñā', { nameUuid: target })],
        }),
      );
      expect(result.entries[0].names[1].nameUuid).toBe(target);
      expect((await snapshot(s)).names.length).toBe(namesBefore);
    });

    it('a names row of another authority is invalid', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('xauth root')],
      });
      const foreign = await s.name({
        authorityUuid: authB,
        language: 'en',
        content: 'foreign',
      });
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, e, {
          names: [...e.names, nm.en('foreign', { nameUuid: foreign })],
        }),
        'invalid',
        'names[1].nameUuid',
      );
      expect(await snapshot(s)).toEqual(before);
    });

    it('a names row that does not exist is invalid', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('nowhere root')],
      });
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, e, {
          names: [...e.names, nm.en('nowhere', { nameUuid: uid() })],
        }),
        'invalid',
        'names[1].nameUuid',
      );
      expect(await snapshot(s)).toEqual(before);
    });

    it("a names row whose text differs from the element's is invalid", async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('mismatch root')],
      });
      const target = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'actual text',
      });
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, e, {
          names: [...e.names, nm.en('claimed text', { nameUuid: target })],
        }),
        'invalid',
        /^names\[1\]\./,
      );
      expect(await snapshot(s)).toEqual(before);
    });
  });
});
