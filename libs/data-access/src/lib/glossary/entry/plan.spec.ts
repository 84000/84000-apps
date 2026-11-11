import { isUuid } from '@eightyfourthousand/lib-utils';

import {
  planSave,
  type NameRow,
  type PlanFailure,
  type PlannedSave,
  type StoredState,
} from './plan';
import type {
  GlossaryEntry,
  GlossaryEntryDelete,
  GlossaryEntryName,
  GlossaryEntryNameInput,
  GlossaryEntrySave,
} from './types';

const W = '10000000-0000-4000-8000-000000000001';
const E1 = '20000000-0000-4000-8000-000000000001';
const E2 = '20000000-0000-4000-8000-000000000002';
const E3 = '20000000-0000-4000-8000-000000000003';
const A = '30000000-0000-4000-8000-000000000001';
const B = '30000000-0000-4000-8000-000000000002';
const C = '30000000-0000-4000-8000-000000000003';
const MISSING = '30000000-0000-4000-8000-0000000000ff';
const r = (n: number) =>
  `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const n = (i: number) =>
  `50000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

const stored = (
  glossaryUuid: string,
  nameUuid: string,
  content: string,
  o: Partial<GlossaryEntryName> = {},
): GlossaryEntryName => ({
  glossaryUuid,
  nameUuid,
  nameAuthorityUuid: A,
  language: 'en',
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});

const input = (
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

const bo = (
  wylie: string,
  script: string | null,
  o: Partial<GlossaryEntryNameInput> = {},
) => input(wylie, { language: 'Bo-Ltn', contentTransformed: script, ...o });

const entry = (
  o: Partial<GlossaryEntry> & Pick<GlossaryEntry, 'names'>,
): GlossaryEntry => ({
  uuid: E1,
  workUuid: W,
  authorityUuid: A,
  definition: null,
  definitionRend: null,
  glossMode: 'match',
  ...o,
});

/** E1: a root, a Tibetan and a Sanskrit name, with every entry-wide value set. */
const mind = () =>
  entry({
    definition: 'Stored.',
    definitionRend: 'appendWithStandard',
    glossMode: 'marked',
    names: [
      stored(E1, n(1), 'mind', {
        termType: 'translationMain',
        attestation: 'attestedSource',
      }),
      stored(r(1), n(2), 'sems', {
        language: 'Bo-Ltn',
        contentTransformed: 'སེམས',
      }),
      stored(r(2), n(3), 'citta', { language: 'Sa-Ltn' }),
    ],
  });

/** The stored state the reads would give for these entries. */
const stateOf = (
  entries: GlossaryEntry[],
  o: Partial<Omit<StoredState, 'names'>> & { names?: NameRow[] } = {},
): StoredState => {
  const rows: StoredState['rows'] = new Map();
  const names: StoredState['names'] = new Map();
  for (const e of entries) {
    for (const name of e.names) {
      const root = name.glossaryUuid === e.uuid;
      rows.set(name.glossaryUuid, {
        uuid: name.glossaryUuid,
        authority_uuid: e.authorityUuid,
        name_uuid: name.nameUuid,
        termType: name.termType,
        attestation: name.attestation,
        definition: root ? e.definition : null,
        definition_rend: root ? e.definitionRend : null,
        glossMode: root && e.glossMode !== 'match' ? e.glossMode : null,
      });
      names.set(name.nameUuid, {
        uuid: name.nameUuid,
        authority_uuid: name.nameAuthorityUuid,
        language: name.language,
        content: name.content,
        content_transformed: name.contentTransformed,
        internal: null,
      });
    }
  }
  for (const row of o.names ?? []) names.set(row.uuid, row);
  return {
    entries: new Map(entries.map((e) => [e.uuid, e])),
    rows,
    takenRows: new Set([...rows.keys(), ...(o.takenRows ?? [])]),
    authorities: o.authorities ?? new Set([A, B, C]),
    names,
    creatorNames: o.creatorNames ?? new Set(),
    usedOutside: o.usedOutside ?? new Set(),
  };
};

const nameRow = (
  uuid: string,
  content: string,
  o: Partial<NameRow> = {},
): NameRow => ({
  uuid,
  authority_uuid: A,
  language: 'en',
  content,
  content_transformed: null,
  internal: null,
  ...o,
});

const plan = (
  state: StoredState,
  saves: GlossaryEntrySave[],
  deletes: GlossaryEntryDelete[] = [],
): PlannedSave => {
  const result = planSave(W, saves, deletes, state);
  if ('reason' in result) {
    throw new Error(`refused: ${result.reason}: ${result.error}`);
  }
  return result;
};

const refusal = (
  state: StoredState,
  saves: GlossaryEntrySave[],
  deletes: GlossaryEntryDelete[] = [],
): PlanFailure => {
  const result = planSave(W, saves, deletes, state);
  if (!('reason' in result)) throw new Error('planned, not refused');
  return result;
};

const edit = (
  names: readonly GlossaryEntryName[],
  glossaryUuid: string,
  patch: Partial<GlossaryEntryName>,
): GlossaryEntryName[] =>
  names.map((name) =>
    name.glossaryUuid === glossaryUuid ? { ...name, ...patch } : name,
  );

const NO_OPS = {
  p_entry_deletes: [],
  p_names_insert: [],
  p_names_update: [],
  p_names_link: [],
  p_glossaries_insert: [],
  p_glossaries_update: [],
  p_glossaries_delete: [],
  p_edges_insert: [],
  p_edges_delete: [],
};

describe('planSave', () => {
  describe('entries that are missing or taken', () => {
    it('refuses a save or delete of an entry the work lacks as not-found, whatever else the call holds', () => {
      const e = mind();
      const state = stateOf([e]);
      const ok: GlossaryEntrySave = {
        uuid: E1,
        change: { definition: 'After.' },
        expect: { definition: 'Stored.' },
      };
      expect(
        refusal(state, [
          ok,
          {
            uuid: E2,
            change: { definition: 'x' },
            expect: { definition: null },
          },
        ]).reason,
      ).toBe('not-found');
      for (const uuid of [E2, r(1)]) {
        expect(refusal(state, [ok], [{ uuid }]).reason).toBe('not-found');
      }
    });

    it('refuses a create whose uuid is any stored row as exists', () => {
      const state = stateOf([mind()]);
      for (const uuid of [E1, r(1)]) {
        expect(
          refusal(state, [
            {
              uuid,
              create: true,
              change: { authorityUuid: A, names: [input('new text')] },
            },
          ]).reason,
        ).toBe('exists');
      }
    });
  });

  describe('expect', () => {
    it('is stale when any expected value differs from what is stored, changed or not', () => {
      const e = mind();
      const state = stateOf([e]);
      const cases: Pick<GlossaryEntrySave, 'change' | 'expect'>[] = [
        {
          change: { definition: 'New.' },
          expect: { definition: 'Something else.' },
        },
        {
          change: { definitionRend: 'prependWithStandard' },
          expect: { definitionRend: 'overrideWithStandard' },
        },
        { change: { glossMode: 'match' }, expect: { glossMode: 'match' } },
        { change: { authorityUuid: C }, expect: { authorityUuid: B } },
        {
          change: { names: edit(e.names, r(2), { content: 'cittam' }) },
          expect: { names: edit(e.names, r(2), { content: 'other text' }) },
        },
        {
          change: {
            names: edit(e.names, E1, { attestation: 'attestedOther' }),
          },
          expect: {
            names: edit(e.names, E1, { attestation: 'attestedDictionary' }),
          },
        },
        {
          change: { names: [...e.names, input('added')] },
          expect: { names: [e.names[0]] },
        },
        {
          change: { names: [...e.names, input('added')] },
          expect: {
            names: [...e.names, { ...e.names[1], glossaryUuid: r(9) }],
          },
        },
        {
          change: { names: [...e.names, input('added')] },
          expect: { names: edit(e.names, r(1), { nameUuid: n(9) }) },
        },
        {
          change: { definition: 'New.' },
          expect: { definition: 'Stored.', glossMode: 'match' },
        },
      ];
      for (const c of cases) {
        const failure = refusal(state, [{ uuid: E1, ...c }]);
        expect(failure).toMatchObject({ reason: 'stale' });
        expect(failure).not.toHaveProperty('retry');
      }
    });

    it('is stale when a changed field has no expected value', () => {
      const state = stateOf([mind()]);
      expect(
        refusal(state, [{ uuid: E1, change: { definition: 'New.' } }]).reason,
      ).toBe('stale');
      expect(
        refusal(state, [
          {
            uuid: E1,
            change: { definition: 'New.', glossMode: 'match' },
            expect: { definition: 'Stored.' },
          },
        ]).reason,
      ).toBe('stale');
    });

    it('needs the names only when the names operations change, compared as a set', () => {
      const e = mind();
      const state = stateOf([e]);
      const reordered = plan(state, [
        {
          uuid: E1,
          change: { definition: 'New.', names: [...e.names].reverse() },
          expect: { definition: 'Stored.' },
        },
      ]);
      expect(reordered.plan.p_glossaries_update).toEqual([
        {
          uuid: E1,
          set: { definition: 'New.' },
          expected: { definition: 'Stored.' },
        },
      ]);

      expect(
        refusal(state, [
          {
            uuid: E1,
            change: {
              names: edit(e.names, r(2), { attestation: 'attestedOther' }),
            },
          },
        ]).reason,
      ).toBe('stale');

      const added = plan(state, [
        {
          uuid: E1,
          change: { definition: 'New.', names: [...e.names, input('added')] },
          expect: { definition: 'Stored.', names: [...e.names].reverse() },
        },
      ]);
      expect(added.entries[0].definition).toBe('New.');
      expect(added.entries[0].names).toHaveLength(4);
    });

    it('treats a null matching mode as match', () => {
      const plain = entry({ names: [stored(E1, n(1), 'plain')] });
      const state = stateOf([plain]);
      for (const glossMode of [null, 'match']) {
        expect(plan(state, [{ uuid: E1, change: { glossMode } }]).writes).toBe(
          false,
        );
      }
      expect(
        plan(state, [
          {
            uuid: E1,
            change: { definition: 'x' },
            expect: { definition: null, glossMode: 'match' },
          },
        ]).writes,
      ).toBe(true);

      const marked = stateOf([{ ...plain, glossMode: 'marked' }]);
      const unset = plan(marked, [
        {
          uuid: E1,
          change: { glossMode: null },
          expect: { glossMode: 'marked' },
        },
      ]);
      expect(unset.plan.p_glossaries_update).toEqual([
        {
          uuid: E1,
          set: { glossMode: null },
          expected: { glossMode: 'marked' },
        },
      ]);
      expect(unset.entries[0].glossMode).toBe('match');
    });
  });

  describe('restating what is stored', () => {
    it('writes nothing, legacy values and odd names included', () => {
      const legacy = entry({
        definition: 'Legacy.',
        definitionRend: 'bothWithStandard',
        names: [
          stored(E1, n(1), 'Tara', {
            language: 'Sa-Ltn',
            termType: 'translationMain',
            attestation: 'attestedSource',
          }),
          stored(r(2), n(2), 'old bo', {
            language: 'Bo-Ltn',
            contentTransformed: null,
          }),
          stored(r(3), n(3), 'foreign', { nameAuthorityUuid: B }),
          stored(r(4), n(4), 'old child', {
            termType: 'legacyType',
            attestation: 'attestedLegacyValue',
          }),
          stored(r(1), n(1), 'Tara', {
            language: 'Sa-Ltn',
            termType: 'translationAlternative',
            attestation: 'attestedDictionary',
          }),
        ],
      });
      const state = stateOf([legacy]);
      const restated = {
        authorityUuid: legacy.authorityUuid,
        definition: legacy.definition,
        definitionRend: legacy.definitionRend,
        glossMode: legacy.glossMode,
        names: legacy.names,
      };
      for (const save of [
        { uuid: E1, change: {} },
        { uuid: E1, change: restated },
        { uuid: E1, change: restated, expect: restated },
      ]) {
        const result = plan(state, [save]);
        expect(result.writes).toBe(false);
        expect(result.plan).toEqual({
          p_entries: [{ uuid: E1, rows: [E1, r(2), r(3), r(4), r(1)] }],
          ...NO_OPS,
        });
        expect(result.entries).toEqual([legacy]);
      }
    });
  });

  describe('fixed values', () => {
    it('refuses a written value outside its set, naming the field', () => {
      const e = mind();
      const state = stateOf([e]);
      const cases: [GlossaryEntrySave['change'], string][] = [
        [
          { names: edit(e.names, r(1), { attestation: 'attestedBogus' }) },
          'names[1].attestation',
        ],
        [
          { names: edit(e.names, E1, { termType: 'translationBogus' }) },
          'names[0].termType',
        ],
        [{ definitionRend: 'bothWithStandard' }, 'definitionRend'],
        [{ definitionRend: 'bogus' }, 'definitionRend'],
        [{ glossMode: 'sometimes' }, 'glossMode'],
        [
          { names: edit(e.names, r(1), { contentTransformed: null }) },
          'names[1].contentTransformed',
        ],
        [
          { names: edit(e.names, r(2), { language: 'Bo-Ltn' }) },
          'names[2].contentTransformed',
        ],
      ];
      for (const [change, field] of cases) {
        expect(refusal(state, [{ uuid: E1, change }])).toMatchObject({
          reason: 'invalid',
          field,
        });
      }
    });

    it('lets stored values outside the sets pass through when they are not written', () => {
      const legacy = entry({
        definition: 'Old.',
        definitionRend: 'bothWithStandard',
        names: [
          stored(E1, n(1), 'old root'),
          stored(r(1), n(2), 'old bo', {
            language: 'Bo-Ltn',
            contentTransformed: null,
          }),
          stored(r(2), n(3), 'old child', {
            termType: 'legacyType',
            attestation: 'attestedLegacyValue',
          }),
          stored(r(3), n(4), 'old plain'),
        ],
      });
      const state = stateOf([legacy]);

      const defined = plan(state, [
        {
          uuid: E1,
          change: { definition: 'Newer.', definitionRend: 'bothWithStandard' },
          expect: { definition: 'Old.' },
        },
      ]);
      expect(defined.plan.p_glossaries_update).toEqual([
        {
          uuid: E1,
          set: { definition: 'Newer.' },
          expected: { definition: 'Old.' },
        },
      ]);
      expect(defined.entries[0].definitionRend).toBe('bothWithStandard');

      const edited = plan(state, [
        {
          uuid: E1,
          change: {
            names: [
              ...edit(legacy.names, r(3), { content: 'old plain 2' }),
              input('old added', { attestation: 'attestedOther' }),
            ],
          },
          expect: { names: legacy.names },
        },
      ]);
      expect(edited.plan.p_glossaries_update.map((u) => u.uuid)).not.toContain(
        r(2),
      );
      const after = edited.entries[0].names;
      expect(after.find((x) => x.glossaryUuid === r(2))).toMatchObject({
        termType: 'legacyType',
        attestation: 'attestedLegacyValue',
      });
      expect(after.find((x) => x.glossaryUuid === r(1))).toMatchObject({
        language: 'Bo-Ltn',
        contentTransformed: null,
      });
    });
  });

  describe('names', () => {
    it("edits a names row in place when nothing else uses it, moving it into the entry's authority", () => {
      const e = mind();
      const changed = plan(stateOf([e]), [
        {
          uuid: E1,
          change: {
            names: edit(e.names, r(1), {
              content: 'sems pa',
              contentTransformed: 'སེམས་པ',
            }),
          },
          expect: { names: e.names },
        },
      ]);
      expect(changed.plan).toEqual({
        p_entries: [{ uuid: E1, rows: [E1, r(1), r(2)] }],
        ...NO_OPS,
        p_names_update: [
          {
            uuid: n(2),
            set: { content: 'sems pa', content_transformed: 'སེམས་པ' },
            expected: { content: 'sems', content_transformed: 'སེམས' },
          },
        ],
      });
      expect(changed.changes.names).toEqual({ inserted: 0, updated: 1 });
      expect(changed.entries[0].names[1]).toMatchObject({
        glossaryUuid: r(1),
        nameUuid: n(2),
        content: 'sems pa',
        contentTransformed: 'སེམས་པ',
      });

      const foreign = {
        ...e,
        names: edit(e.names, r(1), {
          nameAuthorityUuid: B,
        }) as GlossaryEntryName[],
      };
      const moved = plan(stateOf([foreign]), [
        {
          uuid: E1,
          change: {
            names: edit(foreign.names, r(1), { content: 'gzugs brnyan' }),
          },
          expect: { names: foreign.names },
        },
      ]);
      expect(moved.plan.p_names_update).toEqual([
        {
          uuid: n(2),
          set: { content: 'gzugs brnyan', authority_uuid: A },
          expected: { content: 'sems', authority_uuid: B },
        },
      ]);
      expect(moved.entries[0].names[1].nameAuthorityUuid).toBe(A);
    });

    it('copies a names row another entry, a creator, a link in the call or another row of the entry uses', () => {
      const e = mind();
      const other = entry({ uuid: E2, names: [stored(E2, n(4), 'thought')] });
      const internal = nameRow(n(2), 'sems', {
        language: 'Bo-Ltn',
        content_transformed: 'སེམས',
        internal: true,
      });
      const twice = {
        ...e,
        names: [
          ...e.names,
          {
            ...e.names[1],
            glossaryUuid: r(3),
            attestation: 'attestedDictionary',
          },
        ],
      };
      const edited = (x: GlossaryEntry): GlossaryEntrySave => ({
        uuid: E1,
        change: {
          names: edit(x.names, r(1), {
            content: 'sems pa',
            contentTransformed: 'སེམས་པ',
          }),
        },
        expect: { names: x.names },
      });
      const cases: [string, StoredState, GlossaryEntrySave[]][] = [
        [
          'another entry',
          stateOf([e], {
            names: [internal],
            usedOutside: new Set([`${E1}>${n(2)}`]),
          }),
          [edited(e)],
        ],
        [
          'a creator',
          stateOf([e], { names: [internal], creatorNames: new Set([n(2)]) }),
          [edited(e)],
        ],
        [
          'a link in the call',
          stateOf([e, other], { names: [internal] }),
          [
            edited(e),
            {
              uuid: E2,
              change: {
                names: [...other.names, bo('sems', 'སེམས', { nameUuid: n(2) })],
              },
              expect: { names: other.names },
            },
          ],
        ],
        [
          'another row of the entry',
          stateOf([twice], { names: [internal] }),
          [edited(twice)],
        ],
      ];
      for (const [, state, saves] of cases) {
        const result = plan(state, saves);
        expect(result.plan.p_names_update).toEqual([]);
        expect(result.plan.p_names_insert).toEqual([
          {
            uuid: expect.any(String),
            authority_uuid: A,
            language: 'Bo-Ltn',
            content: 'sems pa',
            content_transformed: 'སེམས་པ',
            internal: true,
          },
        ]);
        const copy = result.plan.p_names_insert[0].uuid;
        expect(isUuid(copy)).toBe(true);
        expect(
          result.plan.p_glossaries_update.find((u) => u.uuid === r(1)),
        ).toEqual({
          uuid: r(1),
          set: { name_uuid: copy },
          expected: { name_uuid: n(2) },
        });
        expect(
          result.entries[0].names.find((x) => x.glossaryUuid === r(1)),
        ).toMatchObject({
          nameUuid: copy,
          nameAuthorityUuid: A,
          content: 'sems pa',
        });
      }
    });

    it('changes only the row when only attestation or term type change, shared or not', () => {
      const e = mind();
      const result = plan(
        stateOf([e], { usedOutside: new Set([`${E1}>${n(2)}`]) }),
        [
          {
            uuid: E1,
            change: {
              names: e.names.map((x) => ({
                ...x,
                attestation: 'attestedOther',
                termType: 'translationAlternative',
              })),
            },
            expect: { names: e.names },
          },
        ],
      );
      expect(result.plan.p_names_insert).toEqual([]);
      expect(result.plan.p_names_update).toEqual([]);
      expect(result.changes.names).toEqual({ inserted: 0, updated: 0 });
      expect(result.plan.p_glossaries_update).toEqual([
        {
          uuid: E1,
          set: {
            termType: 'translationAlternative',
            attestation: 'attestedOther',
          },
          expected: {
            termType: 'translationMain',
            attestation: 'attestedSource',
          },
        },
        ...[r(1), r(2)].map((uuid) => ({
          uuid,
          set: {
            termType: 'translationAlternative',
            attestation: 'attestedOther',
          },
          expected: { termType: null, attestation: null },
        })),
      ]);
      expect(result.entries[0].names.map((x) => x.nameUuid)).toEqual(
        e.names.map((x) => x.nameUuid),
      );
    });

    it('links an existing names row of the authority with equal text, on a kept or a new row', () => {
      const e = mind();
      const target = nameRow(n(9), 'link target');
      const prajna = nameRow(n(10), 'prajñā', { language: 'Sa-Ltn' });
      const result = plan(stateOf([e], { names: [target, prajna] }), [
        {
          uuid: E1,
          change: {
            names: [
              ...edit(e.names, r(2), {
                nameUuid: n(9),
                language: 'en',
                content: 'link target',
              }),
              input('prajñā', { language: 'Sa-Ltn', nameUuid: n(10) }),
            ],
          },
          expect: { names: e.names },
        },
      ]);
      expect(result.plan.p_names_link).toEqual([
        {
          uuid: n(9),
          expected: {
            authority_uuid: A,
            language: 'en',
            content: 'link target',
            content_transformed: null,
          },
        },
        {
          uuid: n(10),
          expected: {
            authority_uuid: A,
            language: 'Sa-Ltn',
            content: 'prajñā',
            content_transformed: null,
          },
        },
      ]);
      expect(result.plan.p_names_insert).toEqual([]);
      expect(result.plan.p_names_update).toEqual([]);
      expect(result.plan.p_glossaries_update).toEqual([
        { uuid: r(2), set: { name_uuid: n(9) }, expected: { name_uuid: n(3) } },
      ]);
      expect(result.plan.p_glossaries_insert).toEqual([
        expect.objectContaining({ authority_uuid: A, name_uuid: n(10) }),
      ]);
      expect(result.changes.names).toEqual({ inserted: 0, updated: 0 });
    });

    it('refuses a link that does not exist, is under another authority or has other text', () => {
      const e = mind();
      const state = stateOf([e], {
        names: [
          nameRow(n(9), 'actual text'),
          nameRow(n(11), 'foreign', { authority_uuid: B }),
        ],
      });
      for (const link of [
        input('nowhere', { nameUuid: n(99) }),
        input('foreign', { nameUuid: n(11) }),
        input('claimed text', { nameUuid: n(9) }),
      ]) {
        expect(
          refusal(state, [
            {
              uuid: E1,
              change: { names: [...e.names, link] },
              expect: { names: e.names },
            },
          ]),
        ).toMatchObject({ reason: 'invalid', field: 'names[3].nameUuid' });
      }
      expect(
        refusal(state, [
          {
            uuid: E2,
            create: true,
            change: {
              authorityUuid: A,
              names: [input('ok root'), input('foreign', { nameUuid: n(11) })],
            },
          },
        ]),
      ).toMatchObject({ reason: 'invalid', field: 'names[1].nameUuid' });
    });

    it('deletes a removed name as its row and edge, leaving the names row', () => {
      const e = mind();
      const result = plan(stateOf([e]), [
        {
          uuid: E1,
          change: { names: e.names.filter((x) => x.glossaryUuid !== r(2)) },
          expect: { names: e.names },
        },
      ]);
      expect(result.plan).toEqual({
        p_entries: [{ uuid: E1, rows: [E1, r(1), r(2)] }],
        ...NO_OPS,
        p_glossaries_delete: [{ uuid: r(2), expected: { name_uuid: n(3) } }],
        p_edges_delete: [{ parent_uuid: E1, child_uuid: r(2) }],
      });
      expect(result.changes.glossaries.deleted).toBe(1);
      expect(result.changes.glossaryEdges.deleted).toBe(1);
      expect(result.entries[0].names.map((x) => x.content)).toEqual([
        'mind',
        'sems',
      ]);
    });

    it("refuses removing the entry's root name", () => {
      const e = mind();
      for (const names of [[e.names[1]], []]) {
        expect(
          refusal(stateOf([e]), [
            { uuid: E1, change: { names }, expect: { names: e.names } },
          ]),
        ).toMatchObject({ reason: 'invalid', field: 'names' });
      }
    });

    it('refuses a row of another entry, and inserts a given row uuid that is no row yet', () => {
      const e = mind();
      const theirs = entry({
        uuid: E2,
        names: [stored(E2, n(4), 'theirs'), stored(r(5), n(5), 'theirs too')],
      });
      const state = stateOf([e, theirs]);
      for (const row of theirs.names) {
        expect(
          refusal(state, [
            {
              uuid: E1,
              change: {
                names: [
                  ...e.names,
                  input(row.content, { glossaryUuid: row.glossaryUuid }),
                ],
              },
              expect: { names: e.names },
            },
          ]),
        ).toMatchObject({ reason: 'invalid', field: 'names[3].glossaryUuid' });
      }

      // Moving a row between two entries in one call.
      expect(
        refusal(state, [
          {
            uuid: E1,
            change: { names: [e.names[0]] },
            expect: { names: e.names },
          },
          {
            uuid: E2,
            change: { names: [theirs.names[0], e.names[1]] },
            expect: { names: theirs.names },
          },
        ]),
      ).toMatchObject({ reason: 'invalid', field: 'names[1].glossaryUuid' });

      const added = plan(state, [
        {
          uuid: E1,
          change: {
            names: [...e.names, input('new row', { glossaryUuid: r(9) })],
          },
          expect: { names: e.names },
        },
      ]);
      expect(added.plan.p_glossaries_insert.map((g) => g.uuid)).toEqual([r(9)]);
      expect(added.plan.p_edges_insert).toEqual([
        { parent_uuid: E1, child_uuid: r(9) },
      ]);
    });
  });

  describe('relinking', () => {
    it('moves names rows only the entry uses and copies the others once each', () => {
      const e = entry({
        names: [
          stored(E1, n(1), 'rel root'),
          stored(r(1), n(2), 'rel other work', {
            attestation: 'attestedSource',
          }),
          stored(r(2), n(3), 'rel creator'),
          stored(r(3), n(5), 'rel same work'),
          stored(r(4), n(2), 'rel other work', {
            attestation: 'attestedDictionary',
          }),
          stored(r(5), n(4), 'rel foreign', { nameAuthorityUuid: B }),
          stored(r(6), n(6), 'rel already', { nameAuthorityUuid: C }),
        ],
      });
      const result = plan(
        stateOf([e], {
          usedOutside: new Set([`${E1}>${n(2)}`, `${E1}>${n(5)}`]),
          creatorNames: new Set([n(3)]),
        }),
        [
          {
            uuid: E1,
            change: { authorityUuid: C },
            expect: { authorityUuid: A },
          },
        ],
      );

      expect(result.plan.p_names_update).toEqual([
        {
          uuid: n(1),
          set: { authority_uuid: C },
          expected: { authority_uuid: A },
        },
        {
          uuid: n(4),
          set: { authority_uuid: C },
          expected: { authority_uuid: B },
        },
      ]);
      const copies = result.plan.p_names_insert;
      expect(copies).toEqual(
        ['rel other work', 'rel creator', 'rel same work'].map((content) => ({
          uuid: expect.any(String),
          authority_uuid: C,
          language: 'en',
          content,
          content_transformed: null,
          internal: null,
        })),
      );
      const copyOf = (content: string) =>
        copies.find((c) => c.content === content)?.uuid;

      const updates = new Map(
        result.plan.p_glossaries_update.map((u) => [u.uuid, u]),
      );
      expect(updates.size).toBe(7);
      for (const row of e.names) {
        expect(updates.get(row.glossaryUuid)?.set.authority_uuid).toBe(C);
        expect(updates.get(row.glossaryUuid)?.expected.authority_uuid).toBe(A);
      }
      for (const [row, from, content] of [
        [r(1), n(2), 'rel other work'],
        [r(4), n(2), 'rel other work'],
        [r(2), n(3), 'rel creator'],
        [r(3), n(5), 'rel same work'],
      ]) {
        expect(updates.get(row)).toMatchObject({
          set: { name_uuid: copyOf(content) },
          expected: { name_uuid: from },
        });
      }
      for (const row of [E1, r(5), r(6)]) {
        expect(updates.get(row)?.set).toEqual({ authority_uuid: C });
      }

      const after = result.entries[0];
      expect(after.authorityUuid).toBe(C);
      expect(after.names.every((x) => x.nameAuthorityUuid === C)).toBe(true);
      expect(after.names.find((x) => x.glossaryUuid === r(4))).toMatchObject({
        nameUuid: copyOf('rel other work'),
        attestation: 'attestedDictionary',
      });
      expect(result.changes.names).toEqual({ inserted: 3, updated: 2 });
    });

    it('relinks together with other changes', () => {
      const e = entry({
        definition: 'Before.',
        names: [
          stored(E1, n(1), 'combo root'),
          stored(r(1), n(2), 'combo child'),
        ],
      });
      const result = plan(stateOf([e]), [
        {
          uuid: E1,
          change: {
            authorityUuid: B,
            definition: 'After.',
            names: [...e.names, input('combo added')],
          },
          expect: { authorityUuid: A, definition: 'Before.', names: e.names },
        },
      ]);
      expect(result.plan.p_glossaries_update).toEqual([
        {
          uuid: E1,
          set: { authority_uuid: B, definition: 'After.' },
          expected: { authority_uuid: A, definition: 'Before.' },
        },
        {
          uuid: r(1),
          set: { authority_uuid: B },
          expected: { authority_uuid: A },
        },
      ]);
      expect(result.plan.p_glossaries_insert).toEqual([
        expect.objectContaining({ authority_uuid: B }),
      ]);
      expect(result.plan.p_names_insert).toEqual([
        expect.objectContaining({ authority_uuid: B, content: 'combo added' }),
      ]);
      expect(result.entries[0]).toMatchObject({
        authorityUuid: B,
        definition: 'After.',
      });
      expect(
        result.entries[0].names.every((x) => x.nameAuthorityUuid === B),
      ).toBe(true);
    });

    it('refuses an authority that does not exist, on a relink or a create', () => {
      const state = stateOf([mind()]);
      expect(
        refusal(state, [
          {
            uuid: E1,
            change: { authorityUuid: MISSING },
            expect: { authorityUuid: A },
          },
        ]),
      ).toMatchObject({ reason: 'invalid', field: 'authorityUuid' });
      expect(
        refusal(state, [
          {
            uuid: E2,
            create: true,
            change: { authorityUuid: MISSING, names: [input('no authority')] },
          },
        ]),
      ).toMatchObject({ reason: 'invalid', field: 'authorityUuid' });
    });
  });

  it('writes entry-wide values on the root only, and inserts child rows with them null', () => {
    const e = mind();
    const result = plan(stateOf([e]), [
      {
        uuid: E1,
        change: {
          definition: 'Now defined.',
          definitionRend: 'overrideWithStandard',
          glossMode: 'match',
          names: [...e.names, input('added child')],
        },
        expect: {
          definition: 'Stored.',
          definitionRend: 'appendWithStandard',
          glossMode: 'marked',
          names: e.names,
        },
      },
    ]);
    expect(result.plan.p_glossaries_update).toEqual([
      {
        uuid: E1,
        set: {
          definition: 'Now defined.',
          definition_rend: 'overrideWithStandard',
          glossMode: 'match',
        },
        expected: {
          definition: 'Stored.',
          definition_rend: 'appendWithStandard',
          glossMode: 'marked',
        },
      },
    ]);
    const [child] = result.plan.p_glossaries_insert;
    expect(child).toEqual({
      uuid: expect.any(String),
      authority_uuid: A,
      name_uuid: result.plan.p_names_insert[0].uuid,
      termType: null,
      attestation: null,
      definition: null,
      definition_rend: null,
      glossMode: null,
    });
    expect(result.plan.p_edges_insert).toEqual([
      { parent_uuid: E1, child_uuid: child.uuid },
    ]);
  });

  describe('create', () => {
    it('inserts the root first, every row with an edge from it, and plans each entry in order', () => {
      const result = plan(stateOf([]), [
        {
          uuid: E2,
          create: true,
          change: {
            authorityUuid: A,
            definition: 'Created.',
            definitionRend: 'incompatibleWithStandard',
            glossMode: 'marked',
            names: [
              input('cr root', {
                termType: 'translationMain',
                attestation: 'attestedSource',
              }),
              bo('cr wylie', 'ཀར', { attestation: 'attestedOther' }),
              input('cr sa', {
                language: 'Sa-Ltn',
                termType: 'translationAlternative',
              }),
            ],
          },
        },
        {
          uuid: E3,
          create: true,
          change: { authorityUuid: B, names: [input('cr other')] },
        },
      ]);
      const { plan: p } = result;
      expect(p.p_entries).toEqual([
        { uuid: E2, rows: [] },
        { uuid: E3, rows: [] },
      ]);
      expect(p.p_names_insert).toEqual([
        expect.objectContaining({ authority_uuid: A, content: 'cr root' }),
        expect.objectContaining({
          authority_uuid: A,
          language: 'Bo-Ltn',
          content: 'cr wylie',
          content_transformed: 'ཀར',
        }),
        expect.objectContaining({ authority_uuid: A, content: 'cr sa' }),
        expect.objectContaining({ authority_uuid: B, content: 'cr other' }),
      ]);
      const [root, wylie, sa] = p.p_glossaries_insert;
      expect(root).toEqual({
        uuid: E2,
        authority_uuid: A,
        name_uuid: p.p_names_insert[0].uuid,
        termType: 'translationMain',
        attestation: 'attestedSource',
        definition: 'Created.',
        definition_rend: 'incompatibleWithStandard',
        glossMode: 'marked',
      });
      for (const child of [wylie, sa]) {
        expect(child).toMatchObject({
          authority_uuid: A,
          definition: null,
          definition_rend: null,
          glossMode: null,
        });
      }
      expect(p.p_edges_insert.slice(0, 3)).toEqual(
        [E2, wylie.uuid, sa.uuid].map((child_uuid) => ({
          parent_uuid: E2,
          child_uuid,
        })),
      );
      expect(result.changes).toEqual({
        glossaries: { inserted: 4, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 4, deleted: 0 },
        names: { inserted: 4, updated: 0 },
        annotations: { deleted: 0 },
      });
      expect(result.entries.map((e) => e.uuid)).toEqual([E2, E3]);
      expect(result.entries[0]).toMatchObject({
        uuid: E2,
        workUuid: W,
        authorityUuid: A,
        definition: 'Created.',
        definitionRend: 'incompatibleWithStandard',
        glossMode: 'marked',
      });
      expect(result.entries[1].glossMode).toBe('match');
    });

    it('links existing names rows rather than copying them, and accepts the root carrying the entry uuid', () => {
      const source = mind();
      const result = plan(stateOf([source]), [
        {
          uuid: E2,
          create: true,
          change: {
            authorityUuid: A,
            names: [
              input('mind', { nameUuid: n(1), glossaryUuid: E2 }),
              bo('sems', 'སེམས', { nameUuid: n(2) }),
              input('only new'),
            ],
          },
        },
      ]);
      expect(result.plan.p_names_link.map((l) => l.uuid)).toEqual([n(1), n(2)]);
      expect(result.plan.p_names_insert).toEqual([
        expect.objectContaining({ content: 'only new' }),
      ]);
      expect(result.plan.p_glossaries_insert[0]).toMatchObject({
        uuid: E2,
        name_uuid: n(1),
      });
      expect(result.entries[0].names.map((x) => x.glossaryUuid)).not.toContain(
        E1,
      );
      expect(result.changes.names).toEqual({ inserted: 1, updated: 0 });
    });
  });

  describe('delete', () => {
    it("plans every row of the entry, expecting the root's stored values", () => {
      const e = mind();
      const other = entry({
        uuid: E2,
        definition: 'B before.',
        names: [stored(E2, n(4), 'b root')],
      });
      const result = plan(
        stateOf([e, other]),
        [
          {
            uuid: E2,
            change: { definition: 'B after.' },
            expect: { definition: 'B before.' },
          },
        ],
        [
          {
            uuid: E1,
            expect: {
              authorityUuid: A,
              definition: 'Stored.',
              definitionRend: 'appendWithStandard',
              glossMode: 'marked',
              names: e.names,
            },
          },
        ],
      );
      expect(result.plan.p_entry_deletes).toEqual([
        {
          uuid: E1,
          rows: [E1, r(1), r(2)],
          expected: {
            authority_uuid: A,
            definition: 'Stored.',
            definition_rend: 'appendWithStandard',
            glossMode: 'marked',
          },
        },
      ]);
      expect(result.deleted).toEqual([E1]);
      expect(result.plan.p_glossaries_update).toEqual([
        expect.objectContaining({ uuid: E2, set: { definition: 'B after.' } }),
      ]);
      expect(result.changes.glossaries).toEqual({
        inserted: 0,
        updated: 1,
        deleted: 3,
      });
      expect(result.changes.glossaryEdges).toEqual({ inserted: 0, deleted: 3 });
    });
  });

  describe('definitions', () => {
    it('writes the sanitized definition, and leaves one equal to the stored value as it is', () => {
      const e = { ...mind(), definition: '<p>Old<!-- kept --></p>' };
      const state = stateOf([e]);
      const written = plan(state, [
        {
          uuid: E1,
          change: {
            definition: '<p>New<!-- dropped --><script>x()</script></p>',
          },
          expect: { definition: e.definition },
        },
      ]);
      expect(written.plan.p_glossaries_update[0].set).toEqual({
        definition: '<p>New</p>',
      });
      expect(written.entries[0].definition).toBe('<p>New</p>');

      const emptied = plan(state, [
        {
          uuid: E1,
          change: { definition: '<p><!-- nothing --></p>' },
          expect: { definition: e.definition },
        },
      ]);
      expect(emptied.plan.p_glossaries_update[0].set).toEqual({
        definition: null,
      });

      const same = plan(state, [
        { uuid: E1, change: { definition: e.definition } },
      ]);
      expect(same.writes).toBe(false);
      expect(same.entries[0].definition).toBe('<p>Old<!-- kept --></p>');
    });
  });

  it('projects names in read order: the root, then language, content and row', () => {
    const result = plan(stateOf([]), [
      {
        uuid: E2,
        create: true,
        change: {
          authorityUuid: A,
          names: [
            input('zeta'),
            input('b', { language: 'Sa-Ltn' }),
            input('alpha', { glossaryUuid: r(2) }),
            bo('x', 'ཀ'),
            input('alpha', { glossaryUuid: r(1) }),
          ],
        },
      },
    ]);
    expect(
      result.entries[0].names.map((x) => [x.glossaryUuid, x.content]),
    ).toEqual([
      [E2, 'zeta'],
      [expect.any(String), 'x'],
      [r(1), 'alpha'],
      [r(2), 'alpha'],
      [expect.any(String), 'b'],
    ]);
  });
});
