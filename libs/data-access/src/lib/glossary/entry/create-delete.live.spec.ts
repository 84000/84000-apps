/**
 * @jest-environment node
 */
// DEV-880 acceptance, live: criteria 17 (create), 18 and 19 (delete), plus the
// dry run the interface promises. Skipped unless DEV880_LIVE=1 (see
// live-fixture.ts).
import {
  createGlossaryEntry,
  deleteGlossaryEntry,
  saveGlossaryEntries,
  type DataClient,
} from '../../../index';
import {
  LIVE,
  Scratch,
  countNamesOfAuthority,
  edgesFrom,
  edgesTo,
  expectRefusal,
  expectSuccess,
  glossaryRows,
  integrity,
  interceptApply,
  liveEnv,
  makeEntry,
  nameOf,
  nameRow,
  nm,
  readEntry,
  selectIn,
  serviceClient,
  snapshot,
  storedEntryRows,
  uid,
  zeroChanges,
} from './live-fixture';

const describeLive = LIVE ? describe : describe.skip;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describeLive('DEV-880 live: create and delete (criteria 17, 18, 19)', () => {
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

  describe('17. create', () => {
    it('makes an entry readable as in criterion 1, with a new names row per new name', async () => {
      const uuid = uid();
      const namesBefore = await countNamesOfAuthority(db, authA);
      const result = expectSuccess(
        await createGlossaryEntry({
          client: db,
          workUuid: workA,
          entry: {
            uuid,
            authorityUuid: authA,
            definition: 'Created.',
            definitionRend: 'incompatibleWithStandard',
            glossMode: 'marked',
            names: [
              nm.en('cr root', {
                termType: 'translationMain',
                attestation: 'attestedSource',
              }),
              nm.bo('cr wylie', 'ཀར', { attestation: 'attestedOther' }),
              nm.sa('cr sa', { termType: 'translationAlternative' }),
            ],
          },
        }),
      );
      expect(result.dryRun).toBe(false);
      expect(result.deleted).toEqual([]);
      expect(result.changes).toEqual({
        ...zeroChanges,
        glossaries: { inserted: 3, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 3, deleted: 0 },
        names: { inserted: 3, updated: 0 },
      });

      const read = await readEntry(db, workA, uuid);
      expect(result.entries).toEqual([read]);
      expect(read).toMatchObject({
        uuid,
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Created.',
        definitionRend: 'incompatibleWithStandard',
        glossMode: 'marked',
      });
      expect(read.names[0]).toMatchObject({
        glossaryUuid: uuid,
        content: 'cr root',
        termType: 'translationMain',
        attestation: 'attestedSource',
        nameAuthorityUuid: authA,
      });
      expect(read.names.find((n) => n.language === 'Bo-Ltn')).toMatchObject({
        content: 'cr wylie',
        contentTransformed: 'ཀར',
        attestation: 'attestedOther',
      });

      // New names rows, one per name, in the entry's authority.
      expect(new Set(read.names.map((n) => n.nameUuid)).size).toBe(3);
      expect(await countNamesOfAuthority(db, authA)).toBe(namesBefore + 3);
      for (const n of read.names) {
        expect(await nameRow(db, n.nameUuid)).toMatchObject({
          authority_uuid: authA,
          language: n.language,
          content: n.content,
          content_transformed: n.contentTransformed,
        });
      }

      // Rows: a root with a self-edge, children with an edge from the root, no
      // entry-wide values on a child.
      const { rows, edges } = await storedEntryRows(db, uuid);
      expect(
        edges.map((e) => `${e['parent_uuid']}>${e['child_uuid']}`).sort(),
      ).toEqual(read.names.map((n) => `${uuid}>${n.glossaryUuid}`).sort());
      for (const row of rows) {
        expect(row['work_uuid']).toBe(workA);
        expect(row['authority_uuid']).toBe(authA);
        if (row['uuid'] !== uuid) {
          expect(row['definition']).toBeNull();
          expect(row['definition_rend']).toBeNull();
          expect(row['glossMode']).toBeNull();
        }
      }
      expect(await integrity(s)).toEqual([]);
    });

    it('generates a uuid when none is given', async () => {
      const result = expectSuccess(
        await createGlossaryEntry({
          client: db,
          workUuid: workA,
          entry: { authorityUuid: authA, names: [nm.en('cr generated')] },
        }),
      );
      const uuid = result.entries[0].uuid;
      expect(uuid).toMatch(UUID);
      expect(await readEntry(db, workA, uuid)).toEqual(result.entries[0]);
    });

    it('accepts the root name carrying the entry uuid as its glossaryUuid', async () => {
      const uuid = uid();
      const result = expectSuccess(
        await createGlossaryEntry({
          client: db,
          workUuid: workA,
          entry: {
            uuid,
            authorityUuid: authA,
            names: [nm.en('cr explicit root', { glossaryUuid: uuid })],
          },
        }),
      );
      expect(result.entries[0].names[0].glossaryUuid).toBe(uuid);
    });

    it('reuses an existing names row of the authority rather than copying it', async () => {
      const source = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('cr source root'), nm.bo('cr source wylie', 'སོ')],
      });
      const [rootName, boName] = source.names.map((n) => n.nameUuid);
      const namesBefore = await countNamesOfAuthority(db, authA);
      const result = expectSuccess(
        await createGlossaryEntry({
          client: db,
          workUuid: workB,
          entry: {
            authorityUuid: authA,
            names: [
              nm.en('cr source root', { nameUuid: rootName }),
              nm.bo('cr source wylie', 'སོ', { nameUuid: boName }),
              nm.en('cr only new'),
            ],
          },
        }),
      );
      const copy = result.entries[0];
      expect(copy.workUuid).toBe(workB);
      expect(copy.names[0].nameUuid).toBe(rootName);
      expect(
        copy.names.find((n) => n.content === 'cr source wylie')?.nameUuid,
      ).toBe(boName);
      expect(
        copy.names.find((n) => n.content === 'cr only new')?.nameUuid,
      ).not.toBeUndefined();
      expect(await countNamesOfAuthority(db, authA)).toBe(namesBefore + 1);
      expect(result.changes.names).toEqual({ inserted: 1, updated: 0 });
      // The original is untouched, and the two now share names rows but no rows.
      expect(await readEntry(db, workA, source.uuid)).toEqual(source);
      expect(copy.names.map((n) => n.glossaryUuid)).not.toContain(source.uuid);
      expect(await integrity(s)).toEqual([]);
    });

    it('a names row that is an existing one can also be a non-root name', async () => {
      const existing = await s.name({
        authorityUuid: authA,
        language: 'Sa-Ltn',
        content: 'cr existing sa',
      });
      const result = expectSuccess(
        await createGlossaryEntry({
          client: db,
          workUuid: workA,
          entry: {
            authorityUuid: authA,
            names: [
              nm.en('cr mixed root'),
              nm.sa('cr existing sa', { nameUuid: existing }),
            ],
          },
        }),
      );
      expect(
        result.entries[0].names.find((n) => n.content === 'cr existing sa')
          ?.nameUuid,
      ).toBe(existing);
    });

    it('refuses a names row of a different authority as invalid, creating nothing', async () => {
      const foreign = await s.name({
        authorityUuid: authB,
        language: 'en',
        content: 'cr foreign',
      });
      const before = await snapshot(s);
      const uuid = uid();
      const result = await createGlossaryEntry({
        client: db,
        workUuid: workA,
        entry: {
          uuid,
          authorityUuid: authA,
          names: [
            nm.en('cr ok root'),
            nm.en('cr foreign', { nameUuid: foreign }),
          ],
        },
      });
      expectRefusal(result, 'invalid', 'names[1].nameUuid');
      expect(await snapshot(s)).toEqual(before);
      expect(await glossaryRows(db, [uuid])).toEqual([]);
    });

    it('refuses a names row that does not exist, or whose text differs, as invalid', async () => {
      const actual = await s.name({
        authorityUuid: authA,
        language: 'en',
        content: 'cr actual',
      });
      const before = await snapshot(s);
      expectRefusal(
        await createGlossaryEntry({
          client: db,
          workUuid: workA,
          entry: {
            authorityUuid: authA,
            names: [nm.en('cr nowhere', { nameUuid: uid() })],
          },
        }),
        'invalid',
        'names[0].nameUuid',
      );
      expectRefusal(
        await createGlossaryEntry({
          client: db,
          workUuid: workA,
          entry: {
            authorityUuid: authA,
            names: [nm.en('cr claimed', { nameUuid: actual })],
          },
        }),
        'invalid',
        /^names\[0\]\./,
      );
      expect(await snapshot(s)).toEqual(before);
    });

    it('refuses an entry uuid that already exists, as exists, changing nothing', async () => {
      const existing = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('cr taken root'), nm.en('cr taken child')],
      });
      const elsewhere = await makeEntry(db, {
        workUuid: workB,
        authorityUuid: authA,
        names: [nm.en('cr taken elsewhere')],
      });
      const before = await snapshot(s);
      for (const [work, taken] of [
        [workA, existing.uuid], // an entry of this work
        [workB, existing.uuid], // an entry of another work
        [workA, elsewhere.uuid],
        [workA, existing.names[1].glossaryUuid], // a child row
      ] as const) {
        const result = await createGlossaryEntry({
          client: db,
          workUuid: work,
          entry: {
            uuid: taken,
            authorityUuid: authA,
            names: [nm.en('cr new text')],
          },
        });
        expectRefusal(result, 'exists');
      }
      expect(await snapshot(s)).toEqual(before);
    });

    it('creates several entries in one call', async () => {
      const a = uid();
      const b = uid();
      const result = expectSuccess(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: a,
              create: true,
              change: {
                authorityUuid: authA,
                definition: 'A.',
                names: [nm.en('cr multi a')],
              },
            },
            {
              uuid: b,
              create: true,
              change: {
                authorityUuid: authB,
                names: [nm.en('cr multi b'), nm.sa('cr multi b sa')],
              },
            },
          ],
        }),
      );
      expect(result.entries.map((e) => e.uuid)).toEqual([a, b]);
      expect(await readEntry(db, workA, a)).toMatchObject({
        authorityUuid: authA,
        definition: 'A.',
      });
      expect((await readEntry(db, workA, b)).names).toHaveLength(2);
      expect(await integrity(s)).toEqual([]);
    });
  });

  describe('18 and 19. delete', () => {
    /**
     * Entry E1 in work A with three names; E3 beside it; E2 in work B sharing
     * one of E1's names; a creator on another; passages and annotations in both
     * works citing all of them.
     */
    const deleteFixture = async () => {
      const e1 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'To delete.',
        names: [nm.en('del root'), nm.en('del shared'), nm.en('del creator')],
      });
      const e3 = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('del bystander')],
      });
      const e2 = await makeEntry(db, {
        workUuid: workB,
        authorityUuid: authA,
        names: [
          nm.en('del shared', {
            nameUuid: nameOf(e1, 'del shared').nameUuid,
          }),
        ],
      });
      await s.creator({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: nameOf(e1, 'del creator').nameUuid,
      });
      const [child1, child2] = [
        nameOf(e1, 'del shared').glossaryUuid,
        nameOf(e1, 'del creator').glossaryUuid,
      ];

      const pA1 = await s.passage(workA);
      const pA2 = await s.passage(workA);
      const pB = await s.passage(workB);
      const removed = [
        await s.annotation(pA1, e1.uuid), // the root
        await s.annotation(pA2, child1), // a child row
        await s.annotation(pA2, child2, uid()), // a child row, not the first cited
        await s.annotation(pA1, uid(), e1.uuid), // the root, not the first cited
      ];
      const kept = [
        await s.annotation(pA1, e3.uuid), // another entry of this work
        await s.annotation(pB, e1.uuid), // another work, citing the same uuid
        await s.annotation(pB, e2.uuid), // an entry of another work
        await s.annotation(pA2, uid()), // cites nothing that exists
      ];
      return { e1, e2, e3, removed, kept };
    };

    it("removes the entry's rows, edges and this work's annotations, and leaves everything else", async () => {
      const { e1, e2, e3, removed, kept } = await deleteFixture();
      const e1Rows = e1.names.map((n) => n.glossaryUuid);
      const before = await snapshot(s);
      const e2Before = [
        await readEntry(db, workB, e2.uuid),
        await storedEntryRows(db, e2.uuid),
      ];
      const e3Before = [
        await readEntry(db, workA, e3.uuid),
        await storedEntryRows(db, e3.uuid),
      ];
      const keptBefore = (
        await selectIn(db, 'passage_annotations', 'uuid', kept)
      ).sort((a, b) => String(a['uuid']).localeCompare(String(b['uuid'])));

      const result = expectSuccess(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e1.uuid,
        }),
      );
      expect(result.deleted).toEqual([e1.uuid]);
      expect(result.entries).toEqual([]);
      expect(result.changes).toEqual({
        glossaries: { inserted: 0, updated: 0, deleted: 3 },
        glossaryEdges: { inserted: 0, deleted: 3 },
        names: { inserted: 0, updated: 0 },
        annotations: { deleted: removed.length },
      });

      // 18. Gone: rows, edges, and the citing annotations of this work.
      expect(await glossaryRows(db, e1Rows)).toEqual([]);
      expect(await edgesFrom(db, e1Rows)).toEqual([]);
      expect(await edgesTo(db, e1Rows)).toEqual([]);
      expect(
        await selectIn(db, 'passage_annotations', 'uuid', removed),
      ).toEqual([]);

      // 19. Everything else is as it was.
      const after = await snapshot(s);
      const gone = new Set(e1Rows);
      expect(after.glossaries).toEqual(
        before.glossaries.filter((g) => !gone.has(g['uuid'] as string)),
      );
      expect(after.edges).toEqual(
        before.edges.filter(
          (e) =>
            !gone.has(e['parent_uuid'] as string) &&
            !gone.has(e['child_uuid'] as string),
        ),
      );
      expect(after.names).toEqual(before.names);
      expect(after.creators).toEqual(before.creators);
      expect(after.authorities).toEqual(before.authorities);
      expect(after.otherAuthorities).toBe(before.otherAuthorities);
      const removedSet = new Set(removed);
      expect(after.annotations).toEqual(
        before.annotations.filter((a) => !removedSet.has(a['uuid'] as string)),
      );
      expect(
        (await selectIn(db, 'passage_annotations', 'uuid', kept)).sort((a, b) =>
          String(a['uuid']).localeCompare(String(b['uuid'])),
        ),
      ).toEqual(keptBefore);
      expect(
        await nameRow(db, nameOf(e1, 'del shared').nameUuid),
      ).toMatchObject({
        content: 'del shared',
      });
      expect(await readEntry(db, workB, e2.uuid)).toEqual(e2Before[0]);
      expect(await storedEntryRows(db, e2.uuid)).toEqual(e2Before[1]);
      expect(await readEntry(db, workA, e3.uuid)).toEqual(e3Before[0]);
      expect(await storedEntryRows(db, e3.uuid)).toEqual(e3Before[1]);
      expect(await integrity(s)).toEqual([]);
    });

    it('a deleted entry reads as not-found, and its uuid can be created again', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('del again root'), nm.en('del again child')],
      });
      expectSuccess(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e.uuid,
        }),
      );
      expect(await glossaryRows(db, [e.uuid])).toEqual([]);
      const again = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        uuid: e.uuid,
        names: [nm.en('del again new')],
      });
      expect(again.uuid).toBe(e.uuid);
    });

    it('an entry with no annotations deletes with none counted', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('del quiet')],
      });
      const result = expectSuccess(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e.uuid,
        }),
      );
      expect(result.changes.annotations.deleted).toBe(0);
      expect(result.changes.glossaries.deleted).toBe(1);
    });

    it('a uuid that is not an entry of the work is not-found, and nothing is deleted', async () => {
      const e = await makeEntry(db, {
        workUuid: workB,
        authorityUuid: authA,
        names: [nm.en('del other work'), nm.en('del other child')],
      });
      const before = await snapshot(s);
      for (const uuid of [uid(), e.uuid, e.names[1].glossaryUuid]) {
        expectRefusal(
          await deleteGlossaryEntry({ client: db, workUuid: workA, uuid }),
          'not-found',
        );
      }
      expect(await snapshot(s)).toEqual(before);
    });

    it('deleting with the expected values it read succeeds', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'D.',
        glossMode: 'marked',
        names: [nm.en('del expect root'), nm.en('del expect child')],
      });
      const ok = expectSuccess(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e.uuid,
          expect: {
            authorityUuid: authA,
            definition: 'D.',
            definitionRend: null,
            glossMode: 'marked',
            names: e.names,
          },
        }),
      );
      expect(ok.deleted).toEqual([e.uuid]);
    });
  });

  describe('dry run', () => {
    it('create: returns what would be stored, with generated uuids, and writes nothing', async () => {
      const before = await snapshot(s);
      const { client, applies } = interceptApply(db);
      const result = expectSuccess(
        await createGlossaryEntry({
          client,
          workUuid: workA,
          dryRun: true,
          entry: {
            authorityUuid: authA,
            definition: 'Dry.',
            names: [nm.en('dry root'), nm.en('dry child')],
          },
        }),
      );
      expect(result.dryRun).toBe(true);
      const entry = result.entries[0];
      expect(entry.uuid).toMatch(UUID);
      expect(entry).toMatchObject({
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Dry.',
        glossMode: 'match',
      });
      expect(entry.names.map((n) => n.content)).toEqual([
        'dry root',
        'dry child',
      ]);
      expect(entry.names[0].glossaryUuid).toBe(entry.uuid);
      expect(
        entry.names.every(
          (n) => UUID.test(n.nameUuid) && UUID.test(n.glossaryUuid),
        ),
      ).toBe(true);
      expect(result.changes).toMatchObject({
        glossaries: { inserted: 2, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 2, deleted: 0 },
        names: { inserted: 2, updated: 0 },
      });
      expect(applies()).toBe(0);
      expect(await snapshot(s)).toEqual(before);
      expect(await glossaryRows(db, [entry.uuid])).toEqual([]);
    });

    it("save: returns the entry as it would be stored, with the plan's counts, and writes nothing", async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Dry before.',
        names: [nm.en('dry save root')],
      });
      const before = await snapshot(s);
      const { client, applies } = interceptApply(db);
      const result = expectSuccess(
        await saveGlossaryEntries({
          client,
          workUuid: workA,
          dryRun: true,
          saves: [
            {
              uuid: e.uuid,
              change: {
                definition: 'Dry after.',
                names: [...e.names, nm.en('dry added')],
              },
              expect: { definition: 'Dry before.', names: e.names },
            },
          ],
        }),
      );
      expect(result.dryRun).toBe(true);
      expect(result.entries[0]).toMatchObject({
        uuid: e.uuid,
        definition: 'Dry after.',
      });
      expect(result.entries[0].names).toHaveLength(2);
      expect(result.changes.glossaries.inserted).toBe(1);
      expect(result.changes.glossaries.updated).toBe(1);
      expect(result.changes.glossaryEdges.inserted).toBe(1);
      expect(result.changes.names.inserted).toBe(1);
      expect(applies()).toBe(0);
      expect(await snapshot(s)).toEqual(before);
      expect(await readEntry(db, workA, e.uuid)).toEqual(e);
    });

    it('delete: counts the annotations that would go, and writes nothing', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('dry del root'), nm.en('dry del child')],
      });
      const p = await s.passage(workA);
      await s.annotation(p, e.uuid);
      await s.annotation(p, e.names[1].glossaryUuid);
      await s.annotation(p, uid());
      const before = await snapshot(s);
      const { client, applies } = interceptApply(db);
      const result = expectSuccess(
        await deleteGlossaryEntry({
          client,
          workUuid: workA,
          uuid: e.uuid,
          dryRun: true,
        }),
      );
      expect(result.dryRun).toBe(true);
      expect(result.deleted).toEqual([e.uuid]);
      expect(result.changes.annotations.deleted).toBe(2);
      expect(result.changes.glossaries.deleted).toBe(2);
      expect(applies()).toBe(0);
      expect(await snapshot(s)).toEqual(before);
    });

    it('a dry run whose expectation is stale is refused as stale', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Dry stale.',
        names: [nm.en('dry stale root')],
      });
      expectRefusal(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          dryRun: true,
          saves: [
            {
              uuid: e.uuid,
              change: { definition: 'x' },
              expect: { definition: 'not stored' },
            },
          ],
        }),
        'stale',
      );
    });
  });
});
