import { isUuid } from '@eightyfourthousand/lib-utils';

import type { DataClient } from '../../types';
import * as plan from './plan';
import {
  createGlossaryEntry,
  deleteGlossaryEntry,
  glossaryEntryChange,
  saveGlossaryEntries,
  saveGlossaryEntry,
} from './save';
import type {
  GlossaryEntry,
  GlossaryEntryDTO,
  GlossaryEntryName,
  GlossaryEntryNameInput,
  GlossaryEntrySave,
  GlossarySaveResult,
  GlossarySaveResultDTO,
} from './types';

const W = '10000000-0000-4000-8000-000000000001';
const OTHER_WORK = '10000000-0000-4000-8000-000000000002';
const E1 = '20000000-0000-4000-8000-000000000001';
const E2 = '20000000-0000-4000-8000-000000000002';
const A = '30000000-0000-4000-8000-000000000001';
const B = '30000000-0000-4000-8000-000000000002';
const r = (n: number) =>
  `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const n = (i: number) =>
  `50000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

const ZERO = {
  glossaries: { inserted: 0, updated: 0, deleted: 0 },
  glossaryEdges: { inserted: 0, deleted: 0 },
  names: { inserted: 0, updated: 0 },
  annotations: { deleted: 0 },
};

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

const mind = (): GlossaryEntry => ({
  uuid: E1,
  workUuid: W,
  authorityUuid: A,
  definition: 'Stored.',
  definitionRend: 'appendWithStandard',
  glossMode: 'match',
  names: [
    stored(E1, n(1), 'mind', {
      termType: 'translationMain',
      attestation: 'attestedSource',
    }),
    stored(r(1), n(2), 'sems', {
      language: 'Bo-Ltn',
      contentTransformed: 'སེམས',
      attestation: 'attestedSource',
    }),
    stored(r(2), n(3), 'citta', { language: 'Sa-Ltn' }),
  ],
});

const toDTO = (e: GlossaryEntry): GlossaryEntryDTO => ({
  uuid: e.uuid,
  work_uuid: e.workUuid,
  authority_uuid: e.authorityUuid,
  definition: e.definition,
  definition_rend: e.definitionRend,
  gloss_mode: e.glossMode,
  names: e.names.map((x) => ({
    glossary_uuid: x.glossaryUuid,
    name_uuid: x.nameUuid,
    name_authority_uuid: x.nameAuthorityUuid,
    language: x.language,
    content: x.content,
    content_transformed: x.contentTransformed,
    term_type: x.termType,
    attestation: x.attestation,
  })),
});

type Row = Record<string, unknown>;
type Answer = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

/** What the database holds: entries of any work, and the rows around them. */
type Db = {
  entries: GlossaryEntry[];
  authorities?: string[];
  /** Annotations on passages of a work, citing glossary rows. */
  annotations?: { uuid: string; work: string; cites: string[] }[];
  /** The names rows creators use. */
  creatorNames?: string[];
};

/**
 * A client over `db`. Its tables are derived from the entries on every query,
 * so a test can change `db` between calls. `apply_glossary_save` answers with
 * `apply`; the first `skewedReads` reads see a root row that disagrees with
 * its entry.
 */
const fakeClient = (
  db: Db,
  {
    apply = () => ({
      data: {
        entries: [],
        deleted: [],
        changes: {
          glossaries: ZERO.glossaries,
          glossary_edges: ZERO.glossaryEdges,
          names: ZERO.names,
          annotations: ZERO.annotations,
        },
      },
      error: null,
    }),
    skewedReads = 0,
  }: {
    apply?: (args: Row, call: number) => Answer | Promise<Answer>;
    skewedReads?: number;
  } = {},
) => {
  let reads = 0;
  const applies: Row[] = [];

  const tables = (): Record<string, Row[]> => ({
    glossaries: db.entries.flatMap((e) =>
      e.names.map((x) => {
        const root = x.glossaryUuid === e.uuid;
        return {
          uuid: x.glossaryUuid,
          authority_uuid: e.authorityUuid,
          name_uuid: x.nameUuid,
          termType: x.termType,
          attestation: x.attestation,
          definition:
            root && reads <= skewedReads
              ? 'Skewed.'
              : root
                ? e.definition
                : null,
          definition_rend: root ? e.definitionRend : null,
          glossMode: root ? e.glossMode : null,
        };
      }),
    ),
    names: db.entries.flatMap((e) =>
      e.names.map((x) => ({
        uuid: x.nameUuid,
        authority_uuid: x.nameAuthorityUuid,
        language: x.language,
        content: x.content,
        content_transformed: x.contentTransformed,
        internal: null,
      })),
    ),
    authorities: (db.authorities ?? [A, B]).map((uuid) => ({ uuid })),
    creators: (db.creatorNames ?? []).map((name_uuid) => ({ name_uuid })),
    passage_annotations: (db.annotations ?? []).map((a) => ({
      uuid: a.uuid,
      type: 'glossary-instance',
      'passages.work_uuid': a.work,
      content: a.cites.map((uuid) => ({ uuid })),
    })),
  });

  const from = (table: string) => {
    let rows = tables()[table];
    const builder = {
      select: () => builder,
      order: () => builder,
      in: (column: string, values: string[]) => {
        rows = rows.filter((row) => values.includes(row[column] as string));
        return builder;
      },
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value);
        return builder;
      },
      not: (column: string, _op: string, list: string) => {
        const out = list.slice(1, -1).split(',');
        rows = rows.filter((row) => !out.includes(row[column] as string));
        return builder;
      },
      contains: (column: string, json: string) => {
        const wanted = JSON.parse(json) as { uuid: string }[];
        rows = rows.filter((row) =>
          wanted.every((w) =>
            (row[column] as { uuid: string }[]).some((c) => c.uuid === w.uuid),
          ),
        );
        return builder;
      },
      limit: (count: number) => {
        rows = rows.slice(0, count);
        return builder;
      },
      range: (start: number, end: number) => {
        rows = rows.slice(start, end + 1);
        return builder;
      },
      then: (resolve: (value: Answer) => unknown) =>
        resolve({ data: rows, error: null }),
    };
    return builder;
  };

  const rpc = async (fn: string, args: Row) => {
    if (fn === 'read_glossary_entries') {
      reads += 1;
      const uuids = args['p_uuids'] as string[];
      return {
        data: uuids.flatMap((uuid) =>
          db.entries
            .filter(
              (e) => e.uuid === uuid && e.workUuid === args['p_work_uuid'],
            )
            .map(toDTO),
        ),
        error: null,
      };
    }
    if (fn === 'apply_glossary_save') {
      applies.push(args);
      return apply(args, applies.length);
    }
    throw new Error(`unexpected rpc ${fn}`);
  };

  return {
    client: { from, rpc } as unknown as DataClient,
    applies,
    reads: () => reads,
  };
};

/** A client that fails the test when anything on it is touched. */
const untouchableClient = () => {
  const touched: string[] = [];
  const client = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'string' && prop !== 'then') touched.push(prop);
        return () => {
          throw new Error(`database touched: ${String(prop)}`);
        };
      },
    },
  ) as unknown as DataClient;
  return { client, touched };
};

const failed = (result: GlossarySaveResult) => {
  if (result.success) throw new Error('succeeded');
  return result;
};

const succeeded = (result: GlossarySaveResult) => {
  if (!result.success) {
    throw new Error(`refused: ${result.reason}: ${result.error}`);
  }
  return result;
};

const definitionSave = (definition = 'After.'): GlossaryEntrySave => ({
  uuid: E1,
  change: { definition },
  expect: { definition: 'Stored.' },
});

describe('saveGlossaryEntries', () => {
  it('succeeds without touching the database when there is nothing to save', async () => {
    const { client, touched } = untouchableClient();
    expect(
      await saveGlossaryEntries({ client, workUuid: W, saves: [] }),
    ).toEqual({
      success: true,
      dryRun: false,
      entries: [],
      deleted: [],
      changes: ZERO,
    });
    expect(touched).toEqual([]);
  });

  describe('refuses invalid input before any database call', () => {
    const create = (o: Record<string, unknown>): GlossaryEntrySave => ({
      uuid: E2,
      create: true,
      change: { authorityUuid: A, names: [input('mind')], ...o },
    });
    const added = (name: GlossaryEntryNameInput): GlossaryEntrySave => ({
      uuid: E1,
      change: { names: [...mind().names, name] },
      expect: { names: mind().names },
    });
    const bo = (wylie: string, script: string | null) =>
      input(wylie, { language: 'Bo-Ltn', contentTransformed: script });

    it.each<[string, GlossaryEntrySave[], { uuid: string }[], string]>([
      [
        'a save uuid that is not a uuid',
        [{ uuid: 'not-a-uuid', change: {}, expect: {} }],
        [],
        'uuid',
      ],
      [
        'a row uuid that is not a uuid',
        [added(input('x', { glossaryUuid: 'not-a-uuid' }))],
        [],
        'names[3].glossaryUuid',
      ],
      [
        'an entry saved twice',
        [definitionSave('a'), definitionSave('b')],
        [],
        'uuid',
      ],
      [
        'an entry saved and deleted',
        [definitionSave()],
        [{ uuid: E1 }],
        'uuid',
      ],
      [
        'a row in two entries',
        [
          create({ names: [input('a', { glossaryUuid: E2 })] }),
          {
            uuid: E1,
            create: true,
            change: {
              authorityUuid: A,
              names: [
                input('b', { glossaryUuid: E1 }),
                input('c', { glossaryUuid: E2 }),
              ],
            },
          },
        ],
        [],
        'names[1].glossaryUuid',
      ],
      ['a create without names', [create({ names: [] })], [], 'names'],
      [
        'a create with a non-uuid authority',
        [create({ authorityUuid: 'not-a-uuid' })],
        [],
        'authorityUuid',
      ],
      [
        "a create whose first name's row is not the entry",
        [create({ names: [input('mind', { glossaryUuid: r(1) })] })],
        [],
        'names[0].glossaryUuid',
      ],
      [
        'a create that expects',
        [{ ...create({}), expect: { definition: null } }],
        [],
        'expect',
      ],
      [
        'a create with an attestation outside the set',
        [
          create({
            names: [input('mind'), input('thought', { attestation: 'bogus' })],
          }),
        ],
        [],
        'names[1].attestation',
      ],
      [
        'a create with the legacy definition rend',
        [create({ definitionRend: 'bothWithStandard' })],
        [],
        'definitionRend',
      ],
      [
        'a create with a Tibetan name without its script',
        [create({ names: [input('mind'), bo('sems', '')] })],
        [],
        'names[1].contentTransformed',
      ],
      [
        'a create with a name without a language',
        [create({ names: [input('mind', { language: '' })] })],
        [],
        'names[0].language',
      ],
      [
        'a create with a name without content',
        [create({ names: [input('')] })],
        [],
        'names[0].content',
      ],
      [
        'a new name on a stored entry without its Tibetan script',
        [added(bo('new', null))],
        [],
        'names[3].contentTransformed',
      ],
    ])('%s', async (_name, saves, deletes, field) => {
      const { client, touched } = untouchableClient();
      const result = await saveGlossaryEntries({
        client,
        workUuid: W,
        saves,
        deletes,
      });
      expect(failed(result)).toEqual({
        success: false,
        reason: 'invalid',
        error: expect.any(String),
        field,
        outcomeUnknown: false,
      });
      expect(touched).toEqual([]);
    });
  });

  it('applies nothing when the saves restate what is stored', async () => {
    const e = mind();
    const { client, applies } = fakeClient({ entries: [e] });
    const restated = {
      authorityUuid: e.authorityUuid,
      definition: e.definition,
      definitionRend: e.definitionRend,
      glossMode: e.glossMode,
      names: e.names,
    };
    expect(
      await saveGlossaryEntries({
        client,
        workUuid: W,
        saves: [{ uuid: E1, change: restated, expect: restated }],
      }),
    ).toEqual({
      success: true,
      dryRun: false,
      entries: [e],
      deleted: [],
      changes: ZERO,
    });
    expect(applies).toEqual([]);
  });

  describe('dry run', () => {
    it('returns a create as it would be stored, with generated uuids, and applies nothing', async () => {
      const { client, applies } = fakeClient({ entries: [] });
      const result = succeeded(
        await createGlossaryEntry({
          client,
          workUuid: W,
          dryRun: true,
          entry: {
            authorityUuid: A,
            definition: 'Dry.',
            names: [input('dry root'), input('dry child')],
          },
        }),
      );
      expect(result.dryRun).toBe(true);
      const [entry] = result.entries;
      expect(isUuid(entry.uuid)).toBe(true);
      expect(entry).toMatchObject({
        workUuid: W,
        authorityUuid: A,
        definition: 'Dry.',
        glossMode: 'match',
      });
      expect(entry.names.map((x) => x.content)).toEqual([
        'dry root',
        'dry child',
      ]);
      expect(entry.names[0].glossaryUuid).toBe(entry.uuid);
      expect(
        entry.names.every((x) => isUuid(x.nameUuid) && isUuid(x.glossaryUuid)),
      ).toBe(true);
      expect(result.changes).toEqual({
        glossaries: { inserted: 2, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 2, deleted: 0 },
        names: { inserted: 2, updated: 0 },
        annotations: { deleted: 0 },
      });
      expect(applies).toEqual([]);
    });

    it('copies names rows another entry or a creator uses, and edits the others in place', async () => {
      const e = mind();
      const other: GlossaryEntry = {
        ...mind(),
        uuid: E2,
        workUuid: '30000000-0000-4000-8000-000000000009',
        // The same names row as the first entry's Tibetan name.
        names: [e.names[1]].map((x) => ({ ...x, glossaryUuid: E2 })),
      };
      const { client, applies } = fakeClient({
        entries: [e, other],
        creatorNames: [n(3)],
      });
      const renamed = e.names.map((x) => ({ ...x, content: `${x.content}!` }));
      const result = succeeded(
        await saveGlossaryEntries({
          client,
          workUuid: W,
          dryRun: true,
          saves: [
            {
              uuid: E1,
              change: { names: renamed },
              expect: { names: e.names },
            },
          ],
        }),
      );
      const uuidOf = (content: string) =>
        result.entries[0].names.find((x) => x.content === content)?.nameUuid;
      expect(uuidOf('mind!')).toBe(n(1));
      expect(uuidOf('sems!')).not.toBe(n(2));
      expect(uuidOf('citta!')).not.toBe(n(3));
      expect(result.changes.names).toEqual({ inserted: 2, updated: 1 });
      expect(applies).toEqual([]);
    });

    it("counts a delete's citing annotations in this work once each, and applies nothing", async () => {
      const e = mind();
      const { client, applies } = fakeClient({
        entries: [e],
        annotations: [
          { uuid: 'a1', work: W, cites: [E1] },
          { uuid: 'a2', work: W, cites: [r(1)] },
          { uuid: 'a3', work: W, cites: [r(9), r(2)] },
          { uuid: 'a4', work: W, cites: [E1, r(1)] },
          { uuid: 'a5', work: OTHER_WORK, cites: [E1] },
          { uuid: 'a6', work: W, cites: [r(9)] },
        ],
      });
      const result = succeeded(
        await deleteGlossaryEntry({
          client,
          workUuid: W,
          uuid: E1,
          dryRun: true,
        }),
      );
      expect(result).toMatchObject({
        dryRun: true,
        deleted: [E1],
        entries: [],
      });
      expect(result.changes).toEqual({
        glossaries: { inserted: 0, updated: 0, deleted: 3 },
        glossaryEdges: { inserted: 0, deleted: 3 },
        names: { inserted: 0, updated: 0 },
        annotations: { deleted: 4 },
      });
      expect(applies).toEqual([]);
    });
  });

  describe('retries', () => {
    it.each(['PT409', '23505'])(
      'reads and plans again after %s, applying the plan made from the newer data',
      async (code) => {
        const db: Db = { entries: [mind()] };
        const { client, applies, reads } = fakeClient(db, {
          apply: (_args, call) => {
            if (call > 1)
              return {
                data: { entries: [], deleted: [], changes: {} },
                error: null,
              };
            // Another writer adds a name the save neither changes nor expects.
            db.entries = [
              {
                ...mind(),
                names: [...mind().names, stored(r(5), n(5), 'zz added')],
              },
            ];
            return { data: null, error: { message: 'refused', code } };
          },
        });
        expect(
          succeeded(
            await saveGlossaryEntries({
              client,
              workUuid: W,
              saves: [definitionSave()],
            }),
          ).success,
        ).toBe(true);
        expect(reads()).toBe(2);
        expect(applies.map((a) => a['p_entries'])).toEqual([
          [{ uuid: E1, rows: [E1, r(1), r(2)] }],
          [{ uuid: E1, rows: [E1, r(1), r(2), r(5)] }],
        ]);
      },
    );

    it.each(['PT409', '23505'])(
      'is stale after three refusals with %s',
      async (code) => {
        const { client, applies, reads } = fakeClient(
          { entries: [mind()] },
          {
            apply: () => ({ data: null, error: { message: 'refused', code } }),
          },
        );
        const result = failed(
          await saveGlossaryEntries({
            client,
            workUuid: W,
            saves: [definitionSave()],
          }),
        );
        expect(result).toMatchObject({
          reason: 'stale',
          outcomeUnknown: false,
        });
        expect(result.error).toContain('refused');
        expect(applies).toHaveLength(3);
        expect(reads()).toBe(3);
      },
    );

    it('is stale without applying again when the newer data contradicts the expectation', async () => {
      const db: Db = { entries: [mind()] };
      const { client, applies } = fakeClient(db, {
        apply: () => {
          db.entries = [{ ...mind(), definition: 'Concurrent.' }];
          return { data: null, error: { message: 'refused', code: 'PT409' } };
        },
      });
      const result = failed(
        await saveGlossaryEntries({
          client,
          workUuid: W,
          saves: [definitionSave()],
        }),
      );
      expect(result.reason).toBe('stale');
      expect(applies).toHaveLength(1);
    });

    it('reads again when the reads disagree, and is stale when they keep disagreeing', async () => {
      const once = fakeClient({ entries: [mind()] }, { skewedReads: 1 });
      succeeded(
        await saveGlossaryEntries({
          client: once.client,
          workUuid: W,
          saves: [definitionSave()],
        }),
      );
      expect(once.reads()).toBe(2);
      expect(once.applies).toHaveLength(1);

      const always = fakeClient({ entries: [mind()] }, { skewedReads: 3 });
      expect(
        failed(
          await saveGlossaryEntries({
            client: always.client,
            workUuid: W,
            saves: [definitionSave()],
          }),
        ).reason,
      ).toBe('stale');
      expect(always.reads()).toBe(3);
      expect(always.applies).toEqual([]);
    });
  });

  describe('apply errors', () => {
    it('fails without applying when planning throws', async () => {
      const spy = jest.spyOn(plan, 'planSave').mockImplementationOnce(() => {
        throw new Error('The stored state has nothing for r1');
      });
      const { client, applies } = fakeClient({ entries: [mind()] });
      try {
        const result = failed(
          await saveGlossaryEntries({
            client,
            workUuid: W,
            saves: [definitionSave()],
          }),
        );
        expect(result).toMatchObject({
          reason: 'failed',
          outcomeUnknown: false,
        });
        expect(result.error).toContain('The stored state has nothing for r1');
        expect(applies).toEqual([]);
      } finally {
        spy.mockRestore();
      }
    });

    it.each<[string, () => Answer, Record<string, unknown>]>([
      [
        'a permission error is forbidden',
        () => ({ data: null, error: { message: 'denied', code: '42501' } }),
        { reason: 'forbidden', outcomeUnknown: false },
      ],
      [
        'a rolled-back Postgres error is failed, with nothing saved',
        () => ({ data: null, error: { message: 'no', code: 'P0001' } }),
        {
          reason: 'failed',
          error: 'Nothing was saved: no',
          outcomeUnknown: false,
        },
      ],
      [
        'a rolled-back PostgREST error is failed, with nothing saved',
        () => ({ data: null, error: { message: 'no', code: 'PGRST202' } }),
        {
          reason: 'failed',
          error: 'Nothing was saved: no',
          outcomeUnknown: false,
        },
      ],
      [
        'an error without a code may have been applied',
        () => ({ data: null, error: { message: 'fetch failed' } }),
        {
          reason: 'failed',
          error: 'The save may have been applied: fetch failed',
          outcomeUnknown: true,
        },
      ],
      [
        'an error with an empty code may have been applied',
        () => ({ data: null, error: { message: 'fetch failed', code: '' } }),
        { reason: 'failed', outcomeUnknown: true },
      ],
      [
        'a thrown call may have been applied',
        () => {
          throw new Error('socket hang up');
        },
        {
          reason: 'failed',
          error: 'The save may have been applied: socket hang up',
          outcomeUnknown: true,
        },
      ],
      [
        'a success with no result is failed, not unknown',
        () => ({ data: null, error: null }),
        { reason: 'failed', outcomeUnknown: false },
      ],
      [
        'a success without entries is failed, not unknown',
        () => ({ data: { deleted: [], changes: {} }, error: null }),
        { reason: 'failed', outcomeUnknown: false },
      ],
    ])('%s', async (_name, apply, expected) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { client, applies } = fakeClient({ entries: [mind()] }, { apply });
      const result = await saveGlossaryEntries({
        client,
        workUuid: W,
        saves: [definitionSave()],
      });
      expect(result).toMatchObject({ success: false, ...expected });
      expect(applies).toHaveLength(1);
      jest.restoreAllMocks();
    });
  });
});

describe('glossaryEntryChange', () => {
  it('changes only the fields that differ, expecting their stored values', () => {
    const before = mind();
    const beforeCopy = JSON.parse(JSON.stringify(before));

    expect(glossaryEntryChange(before, { definition: 'New.' })).toEqual({
      change: { definition: 'New.' },
      expect: { definition: 'Stored.' },
    });
    expect(glossaryEntryChange(before, { definition: null })).toEqual({
      change: { definition: null },
      expect: { definition: 'Stored.' },
    });
    expect(
      glossaryEntryChange(before, {
        authorityUuid: before.authorityUuid,
        definition: before.definition,
        definitionRend: before.definitionRend,
        glossMode: before.glossMode,
        names: before.names,
      }),
    ).toEqual({ change: {}, expect: {} });

    const after = {
      authorityUuid: B,
      definition: 'Changed.',
      definitionRend: 'prependWithStandard',
      glossMode: 'marked',
      names: [input('only')],
    };
    const afterCopy = JSON.parse(JSON.stringify(after));
    expect(glossaryEntryChange(before, after)).toEqual({
      change: after,
      expect: {
        authorityUuid: A,
        definition: 'Stored.',
        definitionRend: 'appendWithStandard',
        glossMode: 'match',
        names: before.names,
      },
    });
    expect(before).toEqual(beforeCopy);
    expect(after).toEqual(afterCopy);
  });

  it('treats a null matching mode as match', () => {
    const before = mind();
    expect(glossaryEntryChange(before, { glossMode: null })).toEqual({
      change: {},
      expect: {},
    });
    expect(
      glossaryEntryChange(
        { ...before, glossMode: 'marked' },
        { glossMode: null },
      ),
    ).toEqual({ change: { glossMode: null }, expect: { glossMode: 'marked' } });
  });

  it('compares names as a set', () => {
    const before = mind();
    expect(
      glossaryEntryChange(before, { names: [...before.names].reverse() }),
    ).toEqual({ change: {}, expect: {} });

    for (const names of [
      before.names.map((x) =>
        x.glossaryUuid === r(2) ? { ...x, content: 'cittam' } : x,
      ),
      [...before.names, input('thought')],
      before.names.filter((x) => x.glossaryUuid !== r(2)),
      [...before.names, before.names[1]],
    ]) {
      expect(glossaryEntryChange(before, { names })).toEqual({
        change: { names },
        expect: { names: before.names },
      });
    }
  });
});

describe('single-entry wrappers', () => {
  it('saveGlossaryEntry writes only what differs from the read, and maps the result', async () => {
    const e = mind();
    const saved: GlossarySaveResultDTO = {
      entries: [toDTO({ ...e, definition: 'New.' })],
      deleted: [],
      changes: {
        glossaries: { inserted: 0, updated: 1, deleted: 0 },
        glossary_edges: { inserted: 0, deleted: 0 },
        names: { inserted: 0, updated: 0 },
        annotations: { deleted: 0 },
      },
    };
    const { client, applies } = fakeClient(
      { entries: [e] },
      { apply: () => ({ data: saved, error: null }) },
    );
    const result = await saveGlossaryEntry({
      client,
      workUuid: W,
      before: e,
      after: {
        definition: 'New.',
        glossMode: null,
        names: [...e.names].reverse(),
      },
    });
    expect(result).toEqual({
      success: true,
      dryRun: false,
      entries: [{ ...e, definition: 'New.' }],
      deleted: [],
      changes: {
        ...ZERO,
        glossaries: { inserted: 0, updated: 1, deleted: 0 },
      },
    });
    expect(applies).toHaveLength(1);
    expect(applies[0]).toMatchObject({
      p_work_uuid: W,
      p_glossaries_update: [
        {
          uuid: E1,
          set: { definition: 'New.' },
          expected: { definition: 'Stored.' },
        },
      ],
      p_names_insert: [],
      p_names_update: [],
      p_glossaries_insert: [],
    });
  });

  it('deleteGlossaryEntry is guarded by its expectation', async () => {
    const { client, applies } = fakeClient({ entries: [mind()] });
    expect(
      failed(
        await deleteGlossaryEntry({
          client,
          workUuid: W,
          uuid: E1,
          expect: { definition: 'Not stored.' },
        }),
      ).reason,
    ).toBe('stale');
    expect(applies).toEqual([]);
  });
});
