/**
 * @jest-environment node
 */
// DEV-880 acceptance, live: criteria 5 (round trip), 6 (all or nothing),
// 14 (stale), 15 (fixed values) and 16 (only what is written is checked).
// Skipped unless DEV880_LIVE=1 (see live-fixture.ts).
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_TERM_TYPES,
  createGlossaryEntry,
  deleteGlossaryEntry,
  saveGlossaryEntries,
  type DataClient,
  type GlossaryEntry,
  type GlossaryEntryChange,
  type GlossaryEntryExpect,
} from '../../../index';
import {
  LIVE,
  Scratch,
  anonClient,
  countNamesOfAuthority,
  editName,
  expectRefusal,
  expectSuccess,
  glossaryRows,
  interceptApply,
  liveEnv,
  makeEntry,
  nameOf,
  nm,
  readEntry,
  saveChange,
  serviceClient,
  snapshot,
  storedEntryRows,
  uid,
  zeroChanges,
  type LiveEnv,
} from './live-fixture';

const describeLive = LIVE ? describe : describe.skip;

describeLive('DEV-880 live: guards (criteria 5, 6, 14, 15, 16)', () => {
  let env: LiveEnv;
  let db: DataClient;
  let s: Scratch;
  let workA: string;
  let workB: string;
  let authA: string;
  let authB: string;
  let authC: string;

  beforeAll(async () => {
    env = liveEnv();
    db = serviceClient(env);
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

  /** The change that restates everything the entry already holds. */
  const restated = (e: GlossaryEntry): GlossaryEntryChange => ({
    authorityUuid: e.authorityUuid,
    definition: e.definition,
    definitionRend: e.definitionRend,
    glossMode: e.glossMode,
    names: e.names,
  });

  /** Saves an entry back unchanged, three ways, and asserts nothing at all changed. */
  const expectRoundTrips = async (workUuid: string, uuid: string) => {
    const entry = await readEntry(db, workUuid, uuid);
    const before = await snapshot(s);
    const { client, applies } = interceptApply(db);

    const results = [
      await saveChange(client, workUuid, entry, {}),
      await saveChange(client, workUuid, entry, restated(entry)),
      await saveGlossaryEntries({
        client,
        workUuid,
        saves: [
          {
            uuid,
            change: restated(entry),
            expect: restated(entry) as GlossaryEntryExpect,
          },
        ],
      }),
    ];
    for (const result of results) {
      const ok = expectSuccess(result, 'round trip');
      expect(ok.entries).toEqual([entry]);
      expect(ok.deleted).toEqual([]);
      expect(ok.changes).toEqual(zeroChanges);
    }
    expect(applies()).toBe(0);
    expect(await snapshot(s)).toEqual(before);
    expect(await readEntry(db, workUuid, uuid)).toEqual(entry);
  };

  describe('5. round trip', () => {
    it('a rich entry: definition, rend, mode, every kind of name', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Defined at length.',
        definitionRend: 'overrideWithStandard',
        glossMode: 'marked',
        names: [
          nm.en('rt root', {
            termType: 'translationMain',
            attestation: 'attestedSource',
          }),
          nm.en('rt alt', {
            termType: 'translationAlternative',
            attestation: 'reconstructedPhonetic',
          }),
          nm.bo('rt wylie', 'རྟ', { attestation: 'sourceUnspecified' }),
          nm.sa('rt sa'),
        ],
      });
      await expectRoundTrips(workA, e.uuid);
    });

    it('an entry with no definition and an unset mode', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('rt plain')],
      });
      await expectRoundTrips(workA, e.uuid);
    });

    it('an entry with no English name (a Sanskrit root)', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.sa('rt-sanskrit-root'), nm.bo('rt tib', 'རྟིབ')],
      });
      await expectRoundTrips(workA, e.uuid);
    });

    it('an entry that links a name owned by another authority', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('rt owner root')],
      });
      const foreign = await s.name({
        authorityUuid: authB,
        language: 'en',
        content: 'rt foreign',
      });
      await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: foreign,
        rootUuid: e.uuid,
      });
      await expectRoundTrips(workA, e.uuid);
    });

    it('an entry that links the same name twice with different attestation and term type', async () => {
      const n = await s.name({
        authorityUuid: authA,
        language: 'Sa-Ltn',
        content: 'Tārā',
      });
      const root = await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n,
        termType: 'translationMain',
        attestation: 'attestedSource',
      });
      await s.row({
        workUuid: workA,
        authorityUuid: authA,
        nameUuid: n,
        rootUuid: root,
        termType: 'translationAlternative',
        attestation: 'attestedDictionary',
      });
      const read = await readEntry(db, workA, root);
      expect(read.names.map((x) => x.nameUuid)).toEqual([n, n]);
      await expectRoundTrips(workA, root);
    });

    it('an entry holding values from before the fixed sets (legacy rend and attestation)', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Legacy.',
        names: [nm.en('rt legacy root'), nm.en('rt legacy child')],
      });
      await db
        .from('glossaries')
        .update({ definition_rend: 'bothWithStandard' })
        .eq('uuid', e.uuid);
      await db
        .from('glossaries')
        .update({ attestation: 'attestedLegacyValue', termType: 'legacyType' })
        .eq('uuid', e.names[1].glossaryUuid);
      await expectRoundTrips(workA, e.uuid);
    });

    it('a Tibetan name that has no script stored', async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('rt bo root'), nm.bo('rt bo', 'བོ')],
      });
      await db
        .from('names')
        .update({ content_transformed: null })
        .eq('uuid', e.names[1].nameUuid);
      await expectRoundTrips(workA, e.uuid);
    });

    it('several entries in one call', async () => {
      const a = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [nm.en('rt multi a')],
        definition: 'A.',
      });
      const b = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authB,
        names: [nm.en('rt multi b'), nm.sa('rt multi b sa')],
      });
      const ea = await readEntry(db, workA, a.uuid);
      const eb = await readEntry(db, workA, b.uuid);
      const before = await snapshot(s);
      const ok = expectSuccess(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: a.uuid,
              change: restated(ea),
              expect: restated(ea) as GlossaryEntryExpect,
            },
            {
              uuid: b.uuid,
              change: restated(eb),
              expect: restated(eb) as GlossaryEntryExpect,
            },
          ],
        }),
      );
      expect(ok.entries).toEqual([ea, eb]);
      expect(ok.changes).toEqual(zeroChanges);
      expect(await snapshot(s)).toEqual(before);
    });
  });

  describe('6. all or nothing', () => {
    /** Two entries to change in one call. */
    const pair = async () => {
      const a = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'A before.',
        names: [nm.en('aon a root'), nm.en('aon a child')],
      });
      const b = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'B before.',
        names: [nm.en('aon b root')],
      });
      return { a, b };
    };

    it('both are written when both succeed', async () => {
      const { a, b } = await pair();
      const ok = expectSuccess(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: a.uuid,
              change: { definition: 'A after.' },
              expect: { definition: 'A before.' },
            },
            {
              uuid: b.uuid,
              change: {
                definition: 'B after.',
                names: [...b.names, nm.en('aon b added')],
              },
              expect: { definition: 'B before.', names: b.names },
            },
          ],
        }),
      );
      expect(ok.entries.map((e) => e.definition)).toEqual([
        'A after.',
        'B after.',
      ]);
      expect((await readEntry(db, workA, a.uuid)).definition).toBe('A after.');
      expect((await readEntry(db, workA, b.uuid)).names).toHaveLength(2);
    });

    it('a save that is stale writes nothing for the other saves either', async () => {
      const { a, b } = await pair();
      const before = await snapshot(s);
      const result = await saveGlossaryEntries({
        client: db,
        workUuid: workA,
        saves: [
          {
            uuid: a.uuid,
            change: {
              definition: 'A after.',
              names: [...a.names, nm.en('aon a added')],
            },
            expect: { definition: 'A before.', names: a.names },
          },
          {
            uuid: b.uuid,
            change: { definition: 'B after.' },
            expect: { definition: 'not what is stored' },
          },
        ],
      });
      expectRefusal(result, 'stale');
      expect(await snapshot(s)).toEqual(before);
    });

    it('a save of an entry that does not exist writes nothing for the other saves', async () => {
      const { a } = await pair();
      const before = await snapshot(s);
      const result = await saveGlossaryEntries({
        client: db,
        workUuid: workA,
        saves: [
          {
            uuid: a.uuid,
            change: { definition: 'A after.' },
            expect: { definition: 'A before.' },
          },
          {
            uuid: uid(),
            change: { definition: 'x' },
            expect: { definition: null },
          },
        ],
      });
      expectRefusal(result, 'not-found');
      expect(await snapshot(s)).toEqual(before);
    });

    it('a save and a delete: a failing delete writes nothing for the save', async () => {
      const { a } = await pair();
      const before = await snapshot(s);
      const result = await saveGlossaryEntries({
        client: db,
        workUuid: workA,
        saves: [
          {
            uuid: a.uuid,
            change: { definition: 'A after.' },
            expect: { definition: 'A before.' },
          },
        ],
        deletes: [{ uuid: uid() }],
      });
      expectRefusal(result, 'not-found');
      expect(await snapshot(s)).toEqual(before);
    });

    it('a save and a delete that both succeed are both applied', async () => {
      const { a, b } = await pair();
      const ok = expectSuccess(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: a.uuid,
              change: { definition: 'A after.' },
              expect: { definition: 'A before.' },
            },
          ],
          deletes: [{ uuid: b.uuid }],
        }),
      );
      expect(ok.deleted).toEqual([b.uuid]);
      expect((await readEntry(db, workA, a.uuid)).definition).toBe('A after.');
      expect(await glossaryRows(db, [b.uuid])).toEqual([]);
    });

    it('a change that lands between the read and the apply fails the whole call, writing none of it', async () => {
      const { a, b } = await pair();
      const { client } = interceptApply(db, async () => {
        await db
          .from('glossaries')
          .update({ definition: 'B concurrent.' })
          .eq('uuid', b.uuid);
      });
      const result = await saveGlossaryEntries({
        client,
        workUuid: workA,
        saves: [
          {
            uuid: a.uuid,
            change: {
              definition: 'A after.',
              names: [...a.names, nm.en('aon a added 2')],
            },
            expect: { definition: 'A before.', names: a.names },
          },
          {
            uuid: b.uuid,
            change: { definition: 'B after.' },
            expect: { definition: 'B before.' },
          },
        ],
      });
      expectRefusal(result, 'stale');
      const aNow = await readEntry(db, workA, a.uuid);
      expect(aNow).toEqual(a);
      expect((await readEntry(db, workA, b.uuid)).definition).toBe(
        'B concurrent.',
      );
    });

    it('a create whose uuid is taken between the read and the apply fails the whole call', async () => {
      const { a } = await pair();
      const taken = uid();
      const { client } = interceptApply(db, async () => {
        const n = await s.name({
          authorityUuid: authA,
          language: 'en',
          content: 'sneaked in',
        });
        await s.row({
          workUuid: workB,
          authorityUuid: authA,
          nameUuid: n,
          uuid: taken,
        });
      });
      const result = await saveGlossaryEntries({
        client,
        workUuid: workA,
        saves: [
          {
            uuid: a.uuid,
            change: { definition: 'A after.' },
            expect: { definition: 'A before.' },
          },
          {
            uuid: taken,
            create: true,
            change: { authorityUuid: authA, names: [nm.en('late create')] },
          },
        ],
      });
      expectRefusal(result, ['exists', 'stale']);
      expect(await readEntry(db, workA, a.uuid)).toEqual(a);
      expect(await glossaryRows(db, [taken])).toHaveLength(1);
      expect((await glossaryRows(db, [taken]))[0]['work_uuid']).toBe(workB);
    });
  });

  describe('14. stale values', () => {
    const fixture = async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Stored.',
        definitionRend: 'appendWithStandard',
        glossMode: 'marked',
        names: [
          nm.en('stale root', { attestation: 'attestedSource' }),
          nm.en('stale child'),
        ],
      });
      return e;
    };

    const cases: {
      field: string;
      change: (e: GlossaryEntry) => GlossaryEntryChange;
      expect: (e: GlossaryEntry) => GlossaryEntryExpect;
    }[] = [
      {
        field: 'definition',
        change: () => ({ definition: 'New.' }),
        expect: () => ({ definition: 'Something else.' }),
      },
      {
        field: 'definitionRend',
        change: () => ({ definitionRend: 'prependWithStandard' }),
        expect: () => ({ definitionRend: 'overrideWithStandard' }),
      },
      {
        field: 'glossMode',
        change: () => ({ glossMode: 'match' }),
        expect: () => ({ glossMode: 'match' }),
      },
      {
        field: 'authorityUuid',
        change: () => ({ authorityUuid: authC }),
        expect: () => ({ authorityUuid: authB }),
      },
      {
        field: "names (a name's text)",
        change: (e) => ({
          names: editName(e.names, e.names[1].glossaryUuid, {
            content: 'stale child 2',
          }),
        }),
        expect: (e) => ({
          names: editName(e.names, e.names[1].glossaryUuid, {
            content: 'other text',
          }) as GlossaryEntry['names'],
        }),
      },
      {
        field: "names (a name's attestation)",
        change: (e) => ({
          names: editName(e.names, e.names[0].glossaryUuid, {
            attestation: 'attestedOther',
          }),
        }),
        expect: (e) => ({
          names: editName(e.names, e.names[0].glossaryUuid, {
            attestation: 'attestedDictionary',
          }) as GlossaryEntry['names'],
        }),
      },
      {
        field: 'names (a name is missing)',
        change: (e) => ({ names: [...e.names, nm.en('stale added')] }),
        expect: (e) => ({ names: [e.names[0]] }),
      },
      {
        field: 'names (an extra name)',
        change: (e) => ({ names: [...e.names, nm.en('stale added')] }),
        expect: (e) => ({
          names: [...e.names, { ...e.names[1], glossaryUuid: uid() }],
        }),
      },
      {
        field: 'names (the names row)',
        change: (e) => ({ names: [...e.names, nm.en('stale added')] }),
        expect: (e) => ({
          names: editName(e.names, e.names[1].glossaryUuid, {
            nameUuid: uid(),
          }) as GlossaryEntry['names'],
        }),
      },
    ];

    it.each(cases)(
      '$field differing from what is stored is stale, writing nothing',
      async (c) => {
        const e = await fixture();
        const before = await snapshot(s);
        const result = await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [{ uuid: e.uuid, change: c.change(e), expect: c.expect(e) }],
        });
        expectRefusal(result, 'stale');
        expect(await snapshot(s)).toEqual(before);
      },
    );

    it('a wrong expectation on a field the save does not change is stale too', async () => {
      const e = await fixture();
      const before = await snapshot(s);
      expectRefusal(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: e.uuid,
              change: { definition: 'New.' },
              expect: { definition: 'Stored.', glossMode: 'match' },
            },
          ],
        }),
        'stale',
      );
      expect(await snapshot(s)).toEqual(before);
    });

    it('a changed field with no expected value is stale', async () => {
      const e = await fixture();
      const before = await snapshot(s);
      expectRefusal(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [{ uuid: e.uuid, change: { definition: 'New.' } }],
        }),
        'stale',
      );
      expectRefusal(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: e.uuid,
              change: { definition: 'New.', glossMode: 'match' },
              expect: { definition: 'Stored.' },
            },
          ],
        }),
        'stale',
      );
      expect(await snapshot(s)).toEqual(before);
    });

    it('matching values are accepted, the names in any order', async () => {
      const e = await fixture();
      const ok = expectSuccess(
        await saveGlossaryEntries({
          client: db,
          workUuid: workA,
          saves: [
            {
              uuid: e.uuid,
              change: {
                definition: 'New.',
                names: [...e.names, nm.en('stale ok added')],
              },
              expect: { definition: 'Stored.', names: [...e.names].reverse() },
            },
          ],
        }),
      );
      expect(ok.entries[0].definition).toBe('New.');
      expect(ok.entries[0].names).toHaveLength(3);
    });

    it('a save built from a read that has gone out of date is stale', async () => {
      const e = await fixture();
      const old = await readEntry(db, workA, e.uuid);
      await db
        .from('glossaries')
        .update({ definition: 'Changed by someone else.' })
        .eq('uuid', e.uuid);
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, old, { definition: 'Mine.' }),
        'stale',
      );
      expect(await snapshot(s)).toEqual(before);
      expect((await readEntry(db, workA, e.uuid)).definition).toBe(
        'Changed by someone else.',
      );
    });

    it("a change to the same field between the read and the apply is stale, and only the other writer's value is stored", async () => {
      const e = await fixture();
      const { client } = interceptApply(db, async () => {
        await db
          .from('glossaries')
          .update({ definition: 'Concurrent.' })
          .eq('uuid', e.uuid);
      });
      const result = await saveChange(client, workA, e, {
        definition: 'Mine.',
        glossMode: 'match',
      });
      expectRefusal(result, 'stale');
      const now = await readEntry(db, workA, e.uuid);
      expect(now.definition).toBe('Concurrent.');
      expect(now.glossMode).toBe('marked');
    });

    it('a concurrent change to a name text between the read and the apply is stale', async () => {
      const e = await fixture();
      const { client } = interceptApply(db, async () => {
        await db
          .from('names')
          .update({ content: 'concurrent text' })
          .eq('uuid', e.names[1].nameUuid);
      });
      const result = await saveChange(client, workA, e, {
        names: editName(e.names, e.names[1].glossaryUuid, {
          content: 'my text',
        }),
      });
      expectRefusal(result, 'stale');
      expect(
        (await readEntry(db, workA, e.uuid)).names.find(
          (n) => n.glossaryUuid === e.names[1].glossaryUuid,
        )?.content,
      ).toBe('concurrent text');
    });

    it('a concurrent change to something the save neither changes nor expects does not fail it', async () => {
      const e = await fixture();
      const added = uid();
      const { client } = interceptApply(db, async () => {
        const n = await s.name({
          authorityUuid: authA,
          language: 'en',
          content: 'concurrently added',
        });
        await s.row({
          workUuid: workA,
          authorityUuid: authA,
          nameUuid: n,
          rootUuid: e.uuid,
          uuid: added,
        });
      });
      const result = expectSuccess(
        await saveGlossaryEntries({
          client,
          workUuid: workA,
          saves: [
            {
              uuid: e.uuid,
              change: { definition: 'Mine.' },
              expect: { definition: 'Stored.' },
            },
          ],
        }),
      );
      expect(result.entries[0].definition).toBe('Mine.');
      const now = await readEntry(db, workA, e.uuid);
      expect(now.definition).toBe('Mine.');
      expect(now.names.map((n) => n.glossaryUuid)).toContain(added);
    });

    it('a delete whose expectation differs is stale and deletes nothing', async () => {
      const e = await fixture();
      const before = await snapshot(s);
      expectRefusal(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e.uuid,
          expect: { definition: 'Not stored.' },
        }),
        'stale',
      );
      expect(await snapshot(s)).toEqual(before);
      expectSuccess(
        await deleteGlossaryEntry({
          client: db,
          workUuid: workA,
          uuid: e.uuid,
          expect: { definition: 'Stored.' },
        }),
      );
      expect(await glossaryRows(db, [e.uuid])).toEqual([]);
    });
  });

  describe('15. fixed values', () => {
    const fixture = () =>
      makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Fixed.',
        names: [nm.en('fix root'), nm.en('fix child'), nm.bo('fix bo', 'ཧ')],
      });

    const refused = async (
      mutate: (e: GlossaryEntry) => GlossaryEntryChange,
      field: string,
    ) => {
      const e = await fixture();
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, e, mutate(e)),
        'invalid',
        field,
      );
      expect(await snapshot(s)).toEqual(before);
    };

    it('an attestation outside the set, naming the field', async () => {
      await refused(
        (e) => ({
          names: editName(e.names, e.names[1].glossaryUuid, {
            attestation: 'attestedBogus',
          }),
        }),
        'names[1].attestation',
      );
      await refused(
        (e) => ({
          names: [...e.names, nm.en('fix added', { attestation: 'bogus' })],
        }),
        'names[3].attestation',
      );
    });

    it('a term type outside the set, naming the field', () =>
      refused(
        (e) => ({
          names: editName(e.names, e.names[0].glossaryUuid, {
            termType: 'translationBogus',
          }),
        }),
        'names[0].termType',
      ));

    it('a definition_rend outside the set, the legacy value included', async () => {
      await refused(
        () => ({ definitionRend: 'bothWithStandard' }),
        'definitionRend',
      );
      await refused(() => ({ definitionRend: 'bogus' }), 'definitionRend');
    });

    it('a matching mode outside the set', () =>
      refused(() => ({ glossMode: 'sometimes' }), 'glossMode'));

    it('a Tibetan name needs both its Wylie and its Tibetan script', async () => {
      await refused(
        (e) => ({ names: [...e.names, nm.bo('fix new', '')] }),
        'names[3].contentTransformed',
      );
      await refused(
        (e) => ({
          names: [
            ...e.names,
            { ...nm.bo('fix new', 'ཧ'), contentTransformed: null },
          ],
        }),
        'names[3].contentTransformed',
      );
      await refused(
        (e) => ({ names: [...e.names, nm.bo('', 'ཧ')] }),
        'names[3].content',
      );
      // Editing an existing Tibetan name so that it loses its script.
      await refused(
        (e) => ({
          names: editName(e.names, nameOf(e, 'fix bo').glossaryUuid, {
            contentTransformed: null,
          }),
        }),
        'names[1].contentTransformed',
      );
      // Changing a name to Tibetan without giving it a script.
      await refused(
        (e) => ({
          names: editName(e.names, nameOf(e, 'fix child').glossaryUuid, {
            language: 'Bo-Ltn',
          }),
        }),
        'names[2].contentTransformed',
      );
    });

    it('a written name needs a language and content', async () => {
      await refused(
        (e) => ({ names: [...e.names, nm.en('fix lang', { language: '' })] }),
        'names[3].language',
      );
      await refused(
        (e) => ({ names: [...e.names, nm.en('')] }),
        'names[3].content',
      );
    });

    it('a create with a bad value is refused and creates nothing', async () => {
      const uuid = uid();
      const before = await snapshot(s);
      const namesBefore = await countNamesOfAuthority(db, authA);
      const result = await createGlossaryEntry({
        client: db,
        workUuid: workA,
        entry: {
          uuid,
          authorityUuid: authA,
          names: [
            nm.en('fix create'),
            nm.en('fix create 2', { attestation: 'bogus' }),
          ],
        },
      });
      expectRefusal(result, 'invalid', 'names[1].attestation');
      expect(await glossaryRows(db, [uuid])).toEqual([]);
      expect(await countNamesOfAuthority(db, authA)).toBe(namesBefore);
      expect(await snapshot(s)).toEqual(before);
    });

    it('every value in the sets, and null, is accepted and reads back', async () => {
      const attestations = [...GLOSSARY_ATTESTATIONS, null];
      const termTypes = [...GLOSSARY_TERM_TYPES, null];
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        names: [
          nm.en('all root'),
          ...attestations.map((a, i) =>
            nm.en(`all attestation ${i}`, { attestation: a }),
          ),
          ...termTypes.map((t, i) =>
            nm.en(`all term type ${i}`, { termType: t }),
          ),
        ],
      });
      const read = await readEntry(db, workA, e.uuid);
      for (const [i, a] of attestations.entries()) {
        expect(
          read.names.find((n) => n.content === `all attestation ${i}`)
            ?.attestation,
        ).toBe(a);
      }
      for (const [i, t] of termTypes.entries()) {
        expect(
          read.names.find((n) => n.content === `all term type ${i}`)?.termType,
        ).toBe(t);
      }

      // definition_rend and the matching mode, through saves.
      let current = read;
      for (const rend of [...GLOSSARY_DEFINITION_RENDS, null]) {
        current = expectSuccess(
          await saveChange(db, workA, current, { definitionRend: rend }),
        ).entries[0];
        expect(current.definitionRend).toBe(rend);
      }
      for (const [mode, expected] of [
        ['marked', 'marked'],
        ['match', 'match'],
        [null, 'match'],
      ] as const) {
        current = expectSuccess(
          await saveChange(db, workA, current, { glossMode: mode }),
        ).entries[0];
        expect(current.glossMode).toBe(expected);
      }
    });
  });

  describe('16. only what is written is checked', () => {
    /** An entry carrying values the sets do not allow, as old rows do. */
    const legacy = async () => {
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Old.',
        definitionRend: 'appendWithStandard',
        names: [
          nm.en('old root'),
          nm.en('old child'),
          nm.en('old plain'),
          nm.bo('old bo', 'ཨོ'),
        ],
      });
      await db
        .from('glossaries')
        .update({ definition_rend: 'bothWithStandard' })
        .eq('uuid', e.uuid);
      await db
        .from('glossaries')
        .update({ attestation: 'attestedLegacyValue', termType: 'legacyType' })
        .eq('uuid', nameOf(e, 'old child').glossaryUuid);
      await db
        .from('names')
        .update({ content_transformed: null })
        .eq('uuid', nameOf(e, 'old bo').nameUuid);
      return readEntry(db, workA, e.uuid);
    };

    it('a save that does not write the old values still saves, and leaves them', async () => {
      const e = await legacy();
      expect(e.definitionRend).toBe('bothWithStandard');
      const result = expectSuccess(
        await saveChange(db, workA, e, { definition: 'Newer.' }),
      );
      expect(result.entries[0]).toMatchObject({
        definition: 'Newer.',
        definitionRend: 'bothWithStandard',
      });
      const { rows } = await storedEntryRows(db, e.uuid);
      expect(rows.find((r) => r['uuid'] === e.uuid)?.['definition_rend']).toBe(
        'bothWithStandard',
      );
      const child = rows.find(
        (r) => r['uuid'] === nameOf(e, 'old child').glossaryUuid,
      );
      expect(child).toMatchObject({
        attestation: 'attestedLegacyValue',
        termType: 'legacyType',
      });
    });

    it('restating an old value that equals the stored one is not writing it', async () => {
      const e = await legacy();
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          definition: 'Newer.',
          definitionRend: 'bothWithStandard',
          names: e.names,
        }),
      );
      expect(result.entries[0]).toMatchObject({
        definition: 'Newer.',
        definitionRend: 'bothWithStandard',
      });
    });

    it('other names can be edited while old values pass through', async () => {
      const e = await legacy();
      const result = expectSuccess(
        await saveChange(db, workA, e, {
          names: [
            ...editName(e.names, nameOf(e, 'old plain').glossaryUuid, {
              content: 'old plain 2',
            }),
            nm.en('old added', { attestation: 'attestedOther' }),
          ],
        }),
      );
      const after = result.entries[0];
      expect(
        after.names.find(
          (n) => n.glossaryUuid === nameOf(e, 'old child').glossaryUuid,
        ),
      ).toMatchObject({
        attestation: 'attestedLegacyValue',
        termType: 'legacyType',
      });
      expect(
        after.names.find(
          (n) => n.glossaryUuid === nameOf(e, 'old bo').glossaryUuid,
        ),
      ).toMatchObject({
        language: 'Bo-Ltn',
        contentTransformed: null,
      });
      expect(after.definitionRend).toBe('bothWithStandard');
    });

    it('writing an old value that differs from the stored one is checked and refused', async () => {
      const e = await legacy();
      const fine = expectSuccess(
        await saveChange(db, workA, e, {
          definitionRend: 'appendWithStandard',
        }),
      );
      expect(fine.entries[0].definitionRend).toBe('appendWithStandard');
      const before = await snapshot(s);
      expectRefusal(
        await saveChange(db, workA, fine.entries[0], {
          definitionRend: 'bothWithStandard',
        }),
        'invalid',
        'definitionRend',
      );
      expect(await snapshot(s)).toEqual(before);
    });
  });

  describe('a caller without permission', () => {
    it('is refused as forbidden and writes nothing (an anonymous client)', async () => {
      const anon = anonClient(env);
      if (!anon) {
        console.warn(
          'SUPABASE_ANON_KEY is not set: skipping the anonymous-caller test',
        );
        return;
      }
      const e = await makeEntry(db, {
        workUuid: workA,
        authorityUuid: authA,
        definition: 'Guarded.',
        names: [nm.en('guard root')],
      });
      const before = await snapshot(s);
      const result = await saveChange(anon, workA, e, {
        definition: 'Vandalised.',
      });
      expectRefusal(result, 'forbidden');
      expect(await snapshot(s)).toEqual(before);
    });
  });
});
