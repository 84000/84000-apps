/**
 * @jest-environment node
 */
// DEV-880 acceptance, live: criteria 10 (one authority), 11 (relinking) and
// 12 (no authority writes). Skipped unless DEV880_LIVE=1 (see live-fixture.ts).
import {
  createGlossaryEntry,
  deleteGlossaryEntry,
  type DataClient,
} from '../../../index';
import {
  LIVE,
  Scratch,
  countNames,
  editName,
  expectRefusal,
  expectSuccess,
  integrity,
  liveEnv,
  makeEntry,
  nameRow,
  nm,
  readEntry,
  saveChange,
  serviceClient,
  snapshot,
  storedEntryRows,
  uid,
  zeroChanges,
} from './live-fixture';

const describeLive = LIVE ? describe : describe.skip;

describeLive('DEV-880 live: authorities (criteria 10, 11, 12)', () => {
  let db: DataClient;
  let s: Scratch;
  let workA: string;
  let workB: string;
  let authA: string;
  let authB: string;
  let authC: string;

  beforeAll(async () => {
    db = serviceClient(liveEnv());
    s = new Scratch(db);
    workA = await s.work();
    workB = await s.work();
    authA = await s.authority();
    authB = await s.authority();
    authC = await s.authority();
  });

  afterAll(async () => {
    await s?.cleanup();
  });

  /**
   * An entry in authority A with one of its names owned by authority B: one of
   * the allowed exceptions. `owned` is the foreign `names` row.
   */
  const entryWithForeignName = async (work = workA, text = 'gzugs brnyan') => {
    const e = await makeEntry(db, {
      workUuid: work,
      authorityUuid: authA,
      names: [nm.en(`${text} root`)],
    });
    const owned = await s.name({
      authorityUuid: authB,
      language: 'Bo-Ltn',
      content: text,
      contentTransformed: 'གཟུགས་བརྙན',
    });
    const row = await s.row({
      workUuid: work,
      authorityUuid: authA,
      nameUuid: owned,
      rootUuid: e.uuid,
      attestation: 'attestedSource',
    });
    return { entry: await readEntry(db, work, e.uuid), owned, row };
  };

  describe('10. one authority', () => {
    it('a name owned by another authority still reads and round-trips unchanged', async () => {
      const { entry, owned } = await entryWithForeignName();
      expect(entry.authorityUuid).toBe(authA);
      expect(entry.names[1]).toMatchObject({
        nameUuid: owned,
        nameAuthorityUuid: authB,
      });
      const before = await snapshot(s);
      const result = expectSuccess(
        await saveChange(db, workA, entry, {
          authorityUuid: entry.authorityUuid,
          definition: entry.definition,
          definitionRend: entry.definitionRend,
          glossMode: entry.glossMode,
          names: entry.names,
        }),
      );
      expect(result.changes).toEqual(zeroChanges);
      expect(result.entries[0]).toEqual(entry);
      expect(await snapshot(s)).toEqual(before);
    });

    it("a save that leaves that name untouched keeps its authority, and what it writes is in the entry's", async () => {
      const { entry, owned } = await entryWithForeignName();
      const result = expectSuccess(
        await saveChange(db, workA, entry, {
          definition: 'Written.',
          names: [
            ...entry.names,
            nm.en('a new name'),
            nm.sa('rūpa-pratibimba'),
          ],
        }),
      );
      const after = result.entries[0];
      expect(after.authorityUuid).toBe(authA);
      expect(after.names).toHaveLength(4);
      expect(after.names[1]).toMatchObject({
        nameUuid: owned,
        nameAuthorityUuid: authB,
      });
      expect(await nameRow(db, owned)).toMatchObject({ authority_uuid: authB });
      for (const n of after.names.slice(2))
        expect(n.nameAuthorityUuid).toBe(authA);
      const { rows } = await storedEntryRows(db, entry.uuid);
      expect(rows.every((r) => r['authority_uuid'] === authA)).toBe(true);
      expect(await integrity(s)).toEqual([]);

      // And it still round-trips.
      const again = expectSuccess(
        await saveChange(db, workA, after, {
          authorityUuid: after.authorityUuid,
          names: after.names,
        }),
      );
      expect(again.changes).toEqual(zeroChanges);
    });

    it('a name that only changes attestation keeps its (foreign) names row as it was', async () => {
      const { entry, owned, row } = await entryWithForeignName();
      const result = expectSuccess(
        await saveChange(db, workA, entry, {
          names: editName(entry.names, row, {
            attestation: 'attestedDictionary',
          }),
        }),
      );
      expect(result.entries[0].names[1]).toMatchObject({
        nameUuid: owned,
        nameAuthorityUuid: authB,
        attestation: 'attestedDictionary',
      });
      expect(result.changes.names).toEqual({ inserted: 0, updated: 0 });
    });

    it("editing the text of such a name puts the name the save writes in the entry's authority", async () => {
      const { entry, row } = await entryWithForeignName();
      const result = expectSuccess(
        await saveChange(db, workA, entry, {
          names: editName(entry.names, row, {
            content: 'gzugs brnyan pa',
            contentTransformed: 'གཟུགས་བརྙན་པ',
          }),
        }),
      );
      const written = result.entries[0].names[1];
      expect(written).toMatchObject({
        glossaryUuid: row,
        content: 'gzugs brnyan pa',
        nameAuthorityUuid: authA,
      });
      expect(await nameRow(db, written.nameUuid)).toMatchObject({
        authority_uuid: authA,
        content: 'gzugs brnyan pa',
      });
      expect(await integrity(s)).toEqual([]);
    });

    it('editing such a name when another entry (of its own authority) uses it leaves that entry as it was', async () => {
      const { entry, owned, row } = await entryWithForeignName();
      // An entry in authority B, in another work, whose own name this is.
      const other = await makeEntry(db, {
        workUuid: workB,
        authorityUuid: authB,
        names: [nm.bo('gzugs brnyan', 'གཟུགས་བརྙན', { nameUuid: owned })],
      });
      const otherBefore = await readEntry(db, workB, other.uuid);
      const otherRows = await storedEntryRows(db, other.uuid);
      const result = expectSuccess(
        await saveChange(db, workA, entry, {
          names: editName(entry.names, row, {
            content: 'gzugs brnyan 2',
            contentTransformed: 'གཟུགས་བརྙན་',
          }),
        }),
      );
      const written = result.entries[0].names[1];
      expect(written.nameUuid).not.toBe(owned);
      expect(written.nameAuthorityUuid).toBe(authA);
      expect(await nameRow(db, owned)).toMatchObject({
        authority_uuid: authB,
        content: 'gzugs brnyan',
      });
      expect(await readEntry(db, workB, other.uuid)).toEqual(otherBefore);
      expect(await storedEntryRows(db, other.uuid)).toEqual(otherRows);
    });

    it("every name a save writes is in the entry's authority (create and save)", async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authB,
        names: [nm.en('b root'), nm.bo('b wylie', 'བ'), nm.sa('b sa')],
      });
      expect(e.names.every((n) => n.nameAuthorityUuid === authB)).toBe(true);
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          names: [
            ...editName(e.names, e.names[2].glossaryUuid, {
              content: 'b sa 2',
            }),
            nm.en('b added'),
          ],
        }),
      );
      expect(
        result.entries[0].names.every((n) => n.nameAuthorityUuid === authB),
      ).toBe(true);
    });
  });

  describe('11. relinking', () => {
    it('moves names only this entry used, copies names others use, and leaves those entries unchanged', async () => {
      // Names with known users.
      const n2 = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'rel other work',
      });
      const n3 = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'rel creator',
      });
      const n5 = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'rel same work',
      });
      const n4 = await s.name({
        authorityUuid: authB,
        language: 'en',
        content: 'rel foreign',
      });
      const n6 = await s.name({
        authorityUuid: authC,
        language: 'en',
        content: 'rel already',
      });

      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [
          nm.en('rel root'),
          nm.en('rel other work', {
            nameUuid: n2,
            attestation: 'attestedSource',
          }),
          nm.en('rel creator', { nameUuid: n3 }),
          nm.en('rel same work', { nameUuid: n5 }),
        ],
      });
      // The same shared name twice, a foreign name nobody else uses, and a name
      // that is already in the target authority.
      const dupRow = await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n2,
        rootUuid: e1.uuid,
        attestation: 'attestedDictionary',
      });
      const foreignRow = await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n4,
        rootUuid: e1.uuid,
      });
      const alreadyRow = await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n6,
        rootUuid: e1.uuid,
      });
      const rootName = e1.names[0].nameUuid;

      const e2 = await makeEntry(db, {
        workUuid: workB,
        authorityUuid: authA,
        names: [nm.en('rel other work', { nameUuid: n2 })],
      });
      const e3 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('rel same work', { nameUuid: n5 })],
      });
      await s.creator({ workUuid: workA, authorityUuid: authA, nameUuid: n3 });

      const before = await readEntry(db, workA, e1.uuid);
      expect(before.names).toHaveLength(7);
      const others = async () => [
        await readEntry(db, workB, e2.uuid),
        await storedEntryRows(db, e2.uuid),
        await readEntry(db, workA, e3.uuid),
        await storedEntryRows(db, e3.uuid),
      ];
      const othersBefore = await others();
      const creatorsBefore = (await snapshot(s)).creators;
      const authoritiesBefore = (await snapshot(s)).authorities;

      const result = expectSuccess(
        await saveChange(db, workA, before, { authorityUuid: authC }),
      );
      const after = result.entries[0];
      expect(after.authorityUuid).toBe(authC);

      // Criterion 10 for the new authority.
      const { rows } = await storedEntryRows(db, e1.uuid);
      expect(rows).toHaveLength(7);
      expect(rows.every((r) => r['authority_uuid'] === authC)).toBe(true);
      expect(after.names.every((n) => n.nameAuthorityUuid === authC)).toBe(
        true,
      );
      expect(await integrity(s)).toEqual([]);

      // Names only this entry used are moved: same row, new authority.
      expect(after.names[0].nameUuid).toBe(rootName);
      expect(
        after.names.find((n) => n.glossaryUuid === foreignRow)?.nameUuid,
      ).toBe(n4);
      expect(
        after.names.find((n) => n.glossaryUuid === alreadyRow)?.nameUuid,
      ).toBe(n6);
      for (const moved of [rootName, n4, n6]) {
        expect(await nameRow(db, moved)).toMatchObject({
          authority_uuid: authC,
        });
      }

      // Names others use are copied: a new row with the same text, once per names row.
      const byContent = (c: string) =>
        after.names.filter((n) => n.content === c);
      for (const [content, original] of [
        ['rel other work', n2],
        ['rel creator', n3],
        ['rel same work', n5],
      ] as const) {
        const copies = byContent(content);
        expect(copies.length).toBeGreaterThan(0);
        for (const c of copies) {
          expect(c.nameUuid).not.toBe(original);
          expect(c.nameAuthorityUuid).toBe(authC);
        }
        expect(new Set(copies.map((c) => c.nameUuid)).size).toBe(1);
        expect(await countNames(db, authC, content)).toBe(1);
        expect(await nameRow(db, original)).toMatchObject({
          authority_uuid: authA,
          content,
        });
      }
      expect(
        byContent('rel other work')
          .map((n) => n.glossaryUuid)
          .sort(),
      ).toEqual(
        before.names
          .filter((n) => n.content === 'rel other work')
          .map((n) => n.glossaryUuid)
          .sort(),
      );
      // The row-level values travel with the rows.
      expect(after.names.find((n) => n.glossaryUuid === dupRow)).toMatchObject({
        attestation: 'attestedDictionary',
      });

      // The other entries, and creators, and authorities, are unchanged.
      expect(await others()).toEqual(othersBefore);
      const now = await snapshot(s);
      expect(now.creators).toEqual(creatorsBefore);
      expect(now.authorities).toEqual(authoritiesBefore);

      // It reads back the same, and round-trips.
      const read = await readEntry(db, workA, e1.uuid);
      expect(read).toEqual(after);
      const again = expectSuccess(
        await saveChange(db, workA, read, {
          authorityUuid: authC,
          names: read.names,
        }),
      );
      expect(again.changes).toEqual(zeroChanges);
    });

    it('a relink can be saved together with other changes', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Before.',
        names: [nm.en('combo root'), nm.en('combo child')],
      });
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          authorityUuid: authB,
          definition: 'After.',
          names: [...e.names, nm.en('combo added')],
        }),
      );
      const after = result.entries[0];
      expect(after).toMatchObject({
        authorityUuid: authB,
        definition: 'After.',
      });
      expect(after.names).toHaveLength(3);
      expect(after.names.every((n) => n.nameAuthorityUuid === authB)).toBe(
        true,
      );
      const { rows } = await storedEntryRows(db, e.uuid);
      expect(rows.every((r) => r['authority_uuid'] === authB)).toBe(true);
    });

    it('a relink to an authority that does not exist is refused as invalid, writing nothing', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('nowhere root')],
      });
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, e, { authorityUuid: uid() }),
        'invalid',
        'authorityUuid',
      );
      expect(await snapshot(s)).toEqual(before);
    });
  });

  describe('12. no authority writes', () => {
    it('create, edit, relink and delete leave every authorities row as it was, and add none', async () => {
      const before = await snapshot(s);
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('aw root'), nm.en('aw child')],
      });
      const edited = expectSuccess(
        await saveChange(db, workA, e, {
          definition: 'Edited.',
          names: [...e.names, nm.bo('aw bo', 'ཨ')],
        }),
      ).entries[0];
      const relinked = expectSuccess(
        await saveChange(db, workA, edited, { authorityUuid: authB }),
      ).entries[0];
      expect(relinked.authorityUuid).toBe(authB);
      expectSuccess(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e.uuid,
        }),
      );
      const after = await snapshot(s);
      expect(after.authorities).toEqual(before.authorities);
      expect(after.otherAuthorities).toBe(before.otherAuthorities);
    });

    it('a create that names an authority that does not exist is refused as invalid, writing nothing', async () => {
      const before = await snapshot(s);
      const uuid = uid();
      const result = await createGlossaryEntry({
        client: db,
        workUuid: workA,
        entry: {
          uuid,
          authorityUuid: uid(),
          names: [nm.en('no such authority')],
        },
      });
      expectRefusal(result, 'invalid', 'authorityUuid');
      expect(await snapshot(s)).toEqual(before);
    });
  });
});
