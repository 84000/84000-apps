/**
 * @jest-environment node
 */
// DEV-880 acceptance: contract tests that need no database. `glossaryEntryChange`
// is pure, and input that needs no stored values is refused with
// `reason: 'invalid'` (and the field) before any database call. The fake
// client fails the test if it is touched at all.
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_MODES,
  GLOSSARY_TERM_TYPES,
  createGlossaryEntry,
  deleteGlossaryEntry,
  glossaryEntryChange,
  saveGlossaryEntries,
  type DataClient,
  type GlossaryEntry,
  type GlossaryEntryName,
  type GlossaryEntryNameInput,
} from '../../../index';

const W = '10000000-0000-4000-8000-000000000001';
const E1 = '20000000-0000-4000-8000-000000000001';
const E2 = '20000000-0000-4000-8000-000000000002';
const AUTH = '30000000-0000-4000-8000-000000000001';
const ROW1 = '40000000-0000-4000-8000-000000000001';
const ROW2 = '40000000-0000-4000-8000-000000000002';

/** A client that records every property read from it. Any entry is a failure. */
const untouchableClient = () => {
  const touched: string[] = [];
  const client = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === 'string' && prop !== 'then') touched.push(prop);
        return () => {
          throw new Error(`database touched: ${String(prop)}`);
        };
      },
    },
  ) as unknown as DataClient;
  return { client, touched };
};

const en = (
  content: string,
  o: Partial<GlossaryEntryNameInput> = {},
): GlossaryEntryNameInput => ({
  language: 'en',
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});

const stored = (): GlossaryEntry => ({
  uuid: E1,
  workUuid: W,
  authorityUuid: AUTH,
  definition: 'Stored definition.',
  definitionRend: 'appendWithStandard',
  glossMode: 'match',
  names: [
    {
      glossaryUuid: E1,
      nameUuid: '50000000-0000-4000-8000-000000000001',
      nameAuthorityUuid: AUTH,
      language: 'en',
      content: 'mind',
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
    {
      glossaryUuid: ROW1,
      nameUuid: '50000000-0000-4000-8000-000000000002',
      nameAuthorityUuid: AUTH,
      language: 'Bo-Ltn',
      content: 'sems',
      contentTransformed: 'སེམས',
      termType: null,
      attestation: 'attestedSource',
    },
    {
      glossaryUuid: ROW2,
      nameUuid: '50000000-0000-4000-8000-000000000003',
      nameAuthorityUuid: AUTH,
      language: 'Sa-Ltn',
      content: 'citta',
      contentTransformed: null,
      termType: null,
      attestation: null,
    },
  ],
});

const keyed = (names: readonly GlossaryEntryName[] | undefined) =>
  [...(names ?? [])].sort((a, b) =>
    a.glossaryUuid.localeCompare(b.glossaryUuid),
  );

describe('exported fixed-value sets (criterion 15)', () => {
  it('attestations', () => {
    expect([...GLOSSARY_ATTESTATIONS].sort()).toEqual(
      [
        'attestedApproximate',
        'attestedDictionary',
        'attestedOther',
        'attestedSource',
        'reconstructedPhonetic',
        'reconstructedSemantic',
        'sourceUnspecified',
      ].sort(),
    );
  });

  it('definition_rend values', () => {
    expect([...GLOSSARY_DEFINITION_RENDS].sort()).toEqual([
      'appendWithStandard',
      'incompatibleWithStandard',
      'overrideWithStandard',
      'prependWithStandard',
    ]);
  });

  it('matching modes and term types', () => {
    expect([...GLOSSARY_MODES]).toEqual(['match', 'marked']);
    expect([...GLOSSARY_TERM_TYPES]).toEqual([
      'translationMain',
      'translationAlternative',
    ]);
  });
});

describe('glossaryEntryChange (pure)', () => {
  it('a changed definition is the change, and the stored one is expected (criterion 14)', () => {
    const before = stored();
    const { change, expect: expected } = glossaryEntryChange(before, {
      definition: 'New definition.',
    });
    expect(change.definition).toBe('New definition.');
    expect(expected.definition).toBe('Stored definition.');
    expect(change).not.toHaveProperty('authorityUuid');
    expect(change).not.toHaveProperty('glossMode');
    expect(change).not.toHaveProperty('names');
  });

  it('a field equal to the stored value is not a change', () => {
    const before = stored();
    const { change } = glossaryEntryChange(before, {
      definition: before.definition,
      definitionRend: before.definitionRend,
      authorityUuid: before.authorityUuid,
      glossMode: before.glossMode,
      names: before.names,
    });
    expect(Object.keys(change)).toEqual([]);
  });

  it('null and match are the same matching mode (criterion 3)', () => {
    const before = stored();
    expect(
      Object.keys(glossaryEntryChange(before, { glossMode: null }).change),
    ).toEqual([]);
    const { change, expect: expected } = glossaryEntryChange(before, {
      glossMode: 'marked',
    });
    expect(change.glossMode).toBe('marked');
    expect(expected.glossMode).toBe('match');
  });

  it('clearing a definition is a change to null', () => {
    const { change, expect: expected } = glossaryEntryChange(stored(), {
      definition: null,
    });
    expect(change.definition).toBeNull();
    expect(expected.definition).toBe('Stored definition.');
  });

  it('a relink changes the authority and expects the stored one', () => {
    const other = '30000000-0000-4000-8000-0000000000ff';
    const { change, expect: expected } = glossaryEntryChange(stored(), {
      authorityUuid: other,
    });
    expect(change.authorityUuid).toBe(other);
    expect(expected.authorityUuid).toBe(AUTH);
  });

  it('names: the whole list after the save is the change, the stored list is expected', () => {
    const before = stored();
    const names = before.names.map((n) =>
      n.glossaryUuid === ROW2 ? { ...n, content: 'cittam' } : n,
    );
    const { change, expect: expected } = glossaryEntryChange(before, { names });
    expect(keyed(change.names as GlossaryEntryName[])).toEqual(keyed(names));
    expect(keyed(expected.names)).toEqual(keyed(before.names));
  });

  it('names: adding and removing a name are changes too', () => {
    const before = stored();
    const added = glossaryEntryChange(before, {
      names: [...before.names, en('thought')],
    });
    expect(added.change.names).toHaveLength(4);
    expect(added.expect.names).toHaveLength(3);
    const removed = glossaryEntryChange(before, {
      names: before.names.filter((n) => n.glossaryUuid !== ROW2),
    });
    expect(removed.change.names).toHaveLength(2);
    expect(removed.expect.names).toHaveLength(3);
  });

  it('every field it changes is expected, at the stored value (criterion 14)', () => {
    const before = stored();
    const { change, expect: expected } = glossaryEntryChange(before, {
      authorityUuid: '30000000-0000-4000-8000-0000000000ff',
      definition: 'Changed.',
      definitionRend: 'prependWithStandard',
      glossMode: 'marked',
      names: [en('only')],
    });
    for (const key of Object.keys(change) as (keyof typeof change)[]) {
      expect(expected).toHaveProperty(key);
      if (key === 'names') {
        expect(keyed(expected.names)).toEqual(keyed(before.names));
      } else {
        expect(expected[key]).toEqual(before[key]);
      }
    }
  });

  it('does not modify its inputs', () => {
    const before = stored();
    const after = { definition: 'x', names: [...before.names, en('y')] };
    const beforeCopy = JSON.parse(JSON.stringify(before));
    const afterCopy = JSON.parse(JSON.stringify(after));
    glossaryEntryChange(before, after);
    expect(before).toEqual(beforeCopy);
    expect(after).toEqual(afterCopy);
  });
});

describe('invalid input is refused before any database call (criteria 15, 17)', () => {
  const refuse = async (
    run: (client: DataClient) => Promise<unknown>,
    field: string | RegExp,
  ) => {
    const { client, touched } = untouchableClient();
    const result = (await run(client)) as {
      success: boolean;
      reason?: string;
      field?: string;
      outcomeUnknown?: boolean;
    };
    expect(touched).toEqual([]);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid');
    expect(result.outcomeUnknown).toBe(false);
    if (typeof field === 'string') expect(result.field).toBe(field);
    else expect(result.field).toMatch(field);
  };

  const create = (entry: Record<string, unknown>) => (client: DataClient) =>
    createGlossaryEntry({
      client,
      workUuid: W,
      entry: {
        uuid: E2,
        authorityUuid: AUTH,
        names: [en('mind')],
        ...entry,
      } as never,
    });

  it('create: an attestation outside the set', () =>
    refuse(
      create({ names: [en('mind'), en('thought', { attestation: 'bogus' })] }),
      'names[1].attestation',
    ));

  it('create: a term type outside the set', () =>
    refuse(
      create({ names: [en('mind', { termType: 'translationBogus' })] }),
      'names[0].termType',
    ));

  it('create: a definition_rend outside the set (the legacy value too)', () =>
    refuse(create({ definitionRend: 'bothWithStandard' }), 'definitionRend'));

  it('create: a matching mode outside the set', () =>
    refuse(create({ glossMode: 'sometimes' }), 'glossMode'));

  it('create: a Tibetan name without its script', async () => {
    await refuse(
      create({
        names: [
          en('mind'),
          en('sems', { language: 'Bo-Ltn', contentTransformed: null }),
        ],
      }),
      'names[1].contentTransformed',
    );
    await refuse(
      create({
        names: [
          en('mind'),
          en('sems', { language: 'Bo-Ltn', contentTransformed: '' }),
        ],
      }),
      'names[1].contentTransformed',
    );
  });

  it('create: a Tibetan name without its Wylie', () =>
    refuse(
      create({
        names: [en('', { language: 'Bo-Ltn', contentTransformed: 'སེམས' })],
      }),
      'names[0].content',
    ));

  it('create: a name without language or content', async () => {
    await refuse(
      create({ names: [en('mind', { language: '' })] }),
      'names[0].language',
    );
    await refuse(create({ names: [en('')] }), 'names[0].content');
  });

  it('create: needs at least one name', () =>
    refuse(create({ names: [] }), 'names'));

  it('create: needs an authority', () =>
    refuse(create({ authorityUuid: '' }), 'authorityUuid'));

  it('create: the root name keeps the entry uuid if it names a row', () =>
    refuse(
      create({ names: [en('mind', { glossaryUuid: ROW1 })] }),
      'names[0].glossaryUuid',
    ));

  it('create through saveGlossaryEntries: expect is not allowed', () =>
    refuse(
      (client) =>
        saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [
            {
              uuid: E2,
              create: true,
              change: { authorityUuid: AUTH, names: [en('mind')] },
              expect: { definition: null },
            },
          ],
        }),
      'expect',
    ));

  it('a uuid that is not a uuid', async () => {
    await refuse(
      (client) =>
        saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [{ uuid: 'not-a-uuid', change: {}, expect: {} }],
        }),
      'uuid',
    );
    await refuse(
      (client) =>
        deleteGlossaryEntry({ client, workUuid: W, uuid: 'not-a-uuid' }),
      'uuid',
    );
  });

  it('the same uuid saved twice in one call', () =>
    refuse(
      (client) =>
        saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [
            {
              uuid: E1,
              change: { definition: 'a' },
              expect: { definition: null },
            },
            {
              uuid: E1,
              change: { definition: 'b' },
              expect: { definition: null },
            },
          ],
        }),
      'uuid',
    ));

  it('the same uuid deleted twice, or saved and deleted, in one call', async () => {
    await refuse(
      (client) =>
        saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [],
          deletes: [{ uuid: E1 }, { uuid: E1 }],
        }),
      'uuid',
    );
    await refuse(
      (client) =>
        saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [
            {
              uuid: E1,
              change: { definition: 'a' },
              expect: { definition: null },
            },
          ],
          deletes: [{ uuid: E1 }],
        }),
      'uuid',
    );
  });

  it('a row uuid in two saves', () =>
    refuse(
      (client) =>
        saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [
            {
              uuid: E1,
              create: true,
              change: {
                authorityUuid: AUTH,
                names: [en('a', { glossaryUuid: E1 })],
              },
            },
            {
              uuid: E2,
              create: true,
              change: {
                authorityUuid: AUTH,
                names: [
                  en('b', { glossaryUuid: E2 }),
                  en('c', { glossaryUuid: E1 }),
                ],
              },
            },
          ],
        }),
      /^(uuid|names\[\d+\]\.glossaryUuid)$/,
    ));
});

describe('an empty call', () => {
  it('succeeds with no database call and no changes', async () => {
    const { client, touched } = untouchableClient();
    const result = await saveGlossaryEntries({
      client,
      workUuid: W,
      saves: [],
    });
    expect(touched).toEqual([]);
    expect(result).toMatchObject({ success: true, entries: [], deleted: [] });
    if (result.success) {
      expect(result.changes).toEqual({
        glossaries: { inserted: 0, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 0, deleted: 0 },
        names: { inserted: 0, updated: 0 },
        annotations: { deleted: 0 },
      });
    }
  });
});
