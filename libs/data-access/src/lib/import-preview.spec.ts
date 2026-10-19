import {
  applyImportPreview,
  normalizeImportOperations,
  summarizeImportOperations,
} from './import-preview';
import { savePassagesWithDeletions } from './passage';
import { importPassageUuid } from './passage/derived-uuids';
import { validate as isUuid } from 'uuid';
import {
  previewDtoToPassage,
  type DataClient,
  type ImportOperation,
  type ImportOperationInput,
  type PassageInsertOperation,
} from './types';

jest.mock('./passage', () => ({
  savePassagesWithDeletions: jest.fn(),
}));

const mockedSavePassages = jest.mocked(savePassagesWithDeletions);

/**
 * Minimal chainable Supabase stub. `from(table)` returns a thenable builder
 * whose resolved value depends on the table and the terminal operation, so the
 * persistence functions see the counts / rows configured in `state`.
 */
interface FakeState {
  passagesCount?: number;
  /** Stored passages an earlier import saved, by xmlId. */
  importedPassages?: { uuid: string; xmlId: string }[];
  /** Fail the read of earlier import passages. */
  failImportedRead?: boolean;
  /** Stored passages read by uuid. */
  storedPassages?: { uuid: string; sort: number }[];
  /** Stored annotation rows read by uuid. */
  storedAnnotations?: { uuid: string; passage_uuid: string }[];
  titleRows?: {
    uuid: string;
    type: string;
    language: string | null;
    content: string;
  }[];
  folioRows?: { uuid: string }[];
  titleInserts?: unknown[][];
  titleUpdates?: { patch: Record<string, unknown>; eqs: [string, unknown][] }[];
}

function makeFakeClient(state: FakeState): DataClient {
  return {
    from(table: string) {
      const ctx: {
        table: string;
        op?: string;
        patch?: Record<string, unknown>;
        eqs: [string, unknown][];
        like?: string;
        range?: [number, number];
        in?: unknown[];
      } = { table, eqs: [] };
      const builder = {
        select(_cols: string, _opts?: unknown) {
          ctx.op = 'select';
          return builder;
        },
        insert(rows: unknown[]) {
          ctx.op = 'insert';
          if (table === 'titles') (state.titleInserts ??= []).push(rows);
          return builder;
        },
        update(patch: Record<string, unknown>) {
          ctx.op = 'update';
          ctx.patch = patch;
          return builder;
        },
        eq(col: string, val: unknown) {
          ctx.eqs.push([col, val]);
          return builder;
        },
        in(_col: string, values: unknown[]) {
          ctx.in = values;
          return builder;
        },
        like(_col: string, pattern: string) {
          ctx.like = pattern;
          return builder;
        },
        order() {
          return builder;
        },
        range(from: number, to: number) {
          ctx.range = [from, to];
          return builder;
        },
        then(resolve: (value: unknown) => unknown) {
          let result: unknown = { data: [], count: 0, error: null };
          if (ctx.table === 'passage_annotations' && ctx.in) {
            const values = ctx.in;
            result = {
              data: (state.storedAnnotations ?? []).filter((row) =>
                values.includes(row.uuid),
              ),
              error: null,
            };
          } else if (ctx.table === 'passages' && ctx.in) {
            const values = ctx.in;
            result = {
              data: (state.storedPassages ?? []).filter((row) =>
                values.includes(row.uuid),
              ),
              error: null,
            };
          } else if (ctx.table === 'passages' && ctx.like) {
            const [from, to] = ctx.range ?? [0, Infinity];
            result = state.failImportedRead
              ? { data: null, error: { message: 'read failed' } }
              : {
                  data: (state.importedPassages ?? []).slice(from, to + 1),
                  error: null,
                };
          } else if (ctx.table === 'passages' && ctx.op === 'select') {
            result = { count: state.passagesCount ?? 0, error: null };
          } else if (ctx.table === 'titles' && ctx.op === 'select') {
            result = { data: state.titleRows ?? [], error: null };
          } else if (ctx.table === 'titles' && ctx.op === 'update') {
            (state.titleUpdates ??= []).push({
              patch: ctx.patch ?? {},
              eqs: ctx.eqs,
            });
            result = { error: null };
          } else if (ctx.table === 'folio_annotations' && ctx.op === 'select') {
            result = { data: state.folioRows ?? [], error: null };
          } else {
            result = { data: [], error: null };
          }
          return Promise.resolve(result).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as DataClient;
}

const sampleOps: ImportOperationInput[] = [
  { kind: 'update_work', patch: { toh: 'toh44' } },
  {
    kind: 'upsert_title',
    title: { content: 'བཅོམ་ལྡན་འདས།', type: 'mainTitle', language: 'bo' },
  },
  {
    kind: 'upsert_title',
    title: { content: 'The Blessed One', type: 'mainTitle', language: 'en' },
  },
  {
    kind: 'upsert_passage',
    passage: { label: '1', type: 'translation', content: 'Thus have I heard.' },
  },
];

describe('normalizeImportOperations', () => {
  const workUuid = 'work-123';

  it('fills the owning work and generates a uuid for titles', () => {
    const [op] = normalizeImportOperations(workUuid, [
      {
        kind: 'upsert_title',
        title: {
          content: 'The Blessed One',
          type: 'mainTitle',
          language: 'en',
        },
      },
    ]);

    if (op.kind !== 'upsert_title') throw new Error('expected upsert_title');
    expect(op.title.workUuid).toBe(workUuid);
    expect(op.title.uuid).toEqual(expect.any(String));
    expect(op.title.content).toBe('The Blessed One');
  });

  it('assigns monotonic sort and derived xmlId to passages in source order', () => {
    const ops = normalizeImportOperations(workUuid, [
      {
        kind: 'upsert_passage',
        passage: { label: '1', type: 'translation', content: 'a' },
      },
      {
        kind: 'upsert_passage',
        passage: { label: '2', type: 'translation', content: 'b' },
      },
    ]);

    const passages = ops.filter((o) => o.kind === 'upsert_passage');
    expect(
      passages.map((o) => (o.kind === 'upsert_passage' ? o.passage.sort : -1)),
    ).toEqual([0, 1]);
    expect(
      passages.map((o) => (o.kind === 'upsert_passage' ? o.passage.xmlId : '')),
    ).toEqual(['docx-0', 'docx-1']);
  });

  it('respects an explicit passage sort and continues from it', () => {
    const ops = normalizeImportOperations(workUuid, [
      {
        kind: 'upsert_passage',
        passage: { label: '1', type: 'translation', content: 'a', sort: 5 },
      },
      {
        kind: 'upsert_passage',
        passage: { label: '2', type: 'translation', content: 'b' },
      },
    ]);
    const sorts = ops.map((o) =>
      o.kind === 'upsert_passage' ? o.passage.sort : -1,
    );
    expect(sorts).toEqual([5, 6]);
  });

  it('defaults passage annotations to an empty array', () => {
    const [op] = normalizeImportOperations(workUuid, [
      {
        kind: 'upsert_passage',
        passage: { label: '1', type: 'summary', content: 'x' },
      },
    ]);
    if (op.kind !== 'upsert_passage')
      throw new Error('expected upsert_passage');
    expect(op.annotations).toEqual([]);
  });

  it('passes update_work and update_folio_annotation through unchanged', () => {
    const input: ImportOperationInput[] = [
      { kind: 'update_work', patch: { toh: 'toh44' } },
      {
        kind: 'update_folio_annotation',
        patch: { source_description: 'Degé Kangyur' },
      },
    ];
    expect(normalizeImportOperations(workUuid, input)).toEqual(input);
  });
});

const passageUuids = (ops: ImportOperation[]) =>
  ops.flatMap((o) => (o.kind === 'upsert_passage' ? [o.passage.uuid] : []));

describe('normalizeImportOperations passage uuids', () => {
  const passages = (contents: string[]): ImportOperationInput[] =>
    contents.map((content) => ({
      kind: 'upsert_passage',
      passage: { label: '', type: 'translation', content },
    }));

  it('derives the same valid uuids on every run', () => {
    const first = passageUuids(
      normalizeImportOperations('work-1', passages(['a', 'b'])),
    );
    const second = passageUuids(
      normalizeImportOperations('work-1', passages(['a', 'b'])),
    );

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(2);
    expect(first.every((uuid) => isUuid(uuid))).toBe(true);
  });

  it('keys a passage by its position, not its content', () => {
    const [before] = passageUuids(
      normalizeImportOperations('work-1', passages(['typo'])),
    );
    const [after] = passageUuids(
      normalizeImportOperations('work-1', passages(['fixed'])),
    );
    expect(after).toBe(before);
  });

  it('derives different uuids in different works', () => {
    const [one] = passageUuids(
      normalizeImportOperations('work-1', passages(['a'])),
    );
    const [two] = passageUuids(
      normalizeImportOperations('work-2', passages(['a'])),
    );
    expect(one).not.toBe(two);
  });

  it('keeps an explicit uuid', () => {
    const [uuid] = passageUuids(
      normalizeImportOperations('work-1', [
        {
          kind: 'upsert_passage',
          passage: {
            uuid: 'stored',
            label: '',
            type: 'translation',
            content: 'a',
          },
        },
      ]),
    );
    expect(uuid).toBe('stored');
  });

  it('keeps passages that share an xmlId apart', () => {
    const uuids = passageUuids(
      normalizeImportOperations('work-1', [
        {
          kind: 'upsert_passage',
          passage: { label: '', type: 'translation', content: 'a', sort: 3 },
        },
        {
          kind: 'upsert_passage',
          passage: { label: '', type: 'translation', content: 'b', sort: 3 },
        },
      ]),
    );
    expect(new Set(uuids).size).toBe(2);
  });
});

describe('normalizeImportOperations explicit passage uuids', () => {
  it('does not derive a uuid another passage was sent with', () => {
    const taken = importPassageUuid('w1', 'docx-0');
    const uuids = passageUuids(
      normalizeImportOperations('w1', [
        {
          kind: 'upsert_passage',
          passage: { uuid: taken, label: '', type: 'translation', content: 'a' },
        },
        {
          kind: 'upsert_passage',
          passage: { label: '', type: 'translation', content: 'b', sort: 0 },
        },
      ]),
    );
    expect(uuids[0]).toBe(taken);
    expect(uuids[1]).not.toBe(taken);
    expect(isUuid(uuids[1])).toBe(true);
  });
});

describe('previewDtoToPassage annotation uuids', () => {
  const operation = (
    annotations: PassageInsertOperation['annotations'],
  ): PassageInsertOperation => ({
    kind: 'upsert_passage',
    passage: {
      uuid: 'f3e951bb-a80b-5e6c-a038-a56ee0caa25d',
      workUuid: 'work-1',
      label: '',
      sort: 0,
      type: 'translation',
      content: 'Thus have I heard.',
      xmlId: 'docx-0',
    },
    annotations,
  });
  const span = {
    kind: 'span',
    start: 0,
    end: 4,
    data: { textStyle: 'emphasis' },
  };

  it('derives a valid uuid, the same on every run', () => {
    const first = previewDtoToPassage(operation([span])).annotations;
    const second = previewDtoToPassage(operation([span])).annotations;

    expect(first).toHaveLength(1);
    expect(isUuid(first[0].uuid)).toBe(true);
    expect(second[0].uuid).toBe(first[0].uuid);
  });

  it('derives different uuids for different content at one range', () => {
    const [emphasis, foreign] = previewDtoToPassage(
      operation([span, { ...span, data: { textStyle: 'foreign' } }]),
    ).annotations;
    expect(emphasis.uuid).not.toBe(foreign.uuid);
  });

  it('keeps identical annotations apart', () => {
    const [one, two] = previewDtoToPassage(operation([span, span])).annotations;
    expect(one.uuid).not.toBe(two.uuid);
  });

  it('does not derive a uuid another annotation was sent with', () => {
    const [derived] = previewDtoToPassage(operation([span])).annotations;
    const [explicit, fresh] = previewDtoToPassage(
      operation([{ ...span, uuid: derived.uuid }, span]),
    ).annotations;

    expect(explicit.uuid).toBe(derived.uuid);
    expect(fresh.uuid).not.toBe(derived.uuid);
    expect(isUuid(fresh.uuid)).toBe(true);
  });

  it('keeps an explicit uuid', () => {
    const [annotation] = previewDtoToPassage(
      operation([{ ...span, uuid: 'stored' }]),
    ).annotations;
    expect(annotation.uuid).toBe('stored');
  });
});

describe('applyImportPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSavePassages.mockResolvedValue({ success: true } as never);
  });

  it('inserts all titles when the work has none yet', async () => {
    const state: FakeState = {
      passagesCount: 0,
      titleRows: [],
      titleInserts: [],
    };
    const client = makeFakeClient(state);

    const result = await applyImportPreview({
      client,
      workUuid: 'w1',
      operations: sampleOps,
    });

    expect(state.titleInserts).toHaveLength(1);
    expect(state.titleInserts?.[0]).toHaveLength(2);
    expect(state.titleUpdates ?? []).toHaveLength(0);
    expect(result.counts.titles).toBe(2);
    expect(result.counts.titlesUpdated).toBe(0);
    expect(result.counts.passages).toBe(1);
    expect(mockedSavePassages).toHaveBeenCalledTimes(1);
  });

  it('updates an existing slot to the document content and inserts new slots', async () => {
    // Work already has a (stale) Tibetan main title; the English one is missing.
    const state: FakeState = {
      passagesCount: 0,
      titleRows: [
        {
          uuid: 't-bo',
          type: 'mainTitle',
          language: 'bo',
          content: 'stale bo title',
        },
      ],
      titleInserts: [],
    };
    const client = makeFakeClient(state);

    const result = await applyImportPreview({
      client,
      workUuid: 'w1',
      operations: sampleOps,
    });

    // English slot inserted...
    expect(state.titleInserts).toHaveLength(1);
    const inserted = state.titleInserts?.[0] as { language: string }[];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].language).toBe('en');

    // ...Tibetan slot updated in place to the document's content.
    expect(state.titleUpdates).toHaveLength(1);
    expect(state.titleUpdates?.[0].eqs).toContainEqual(['uuid', 't-bo']);
    expect(state.titleUpdates?.[0].patch.content).toBe('བཅོམ་ལྡན་འདས།');

    expect(result.counts.titles).toBe(1);
    expect(result.counts.titlesUpdated).toBe(1);
  });

  it('updates every slot and inserts none when all slots already exist', async () => {
    const state: FakeState = {
      passagesCount: 0,
      titleRows: [
        {
          uuid: 't-bo',
          type: 'mainTitle',
          language: 'bo',
          content: 'stale bo',
        },
        {
          uuid: 't-en',
          type: 'mainTitle',
          language: 'en',
          content: 'stale en',
        },
      ],
      titleInserts: [],
    };
    const client = makeFakeClient(state);

    const result = await applyImportPreview({
      client,
      workUuid: 'w1',
      operations: sampleOps,
    });

    expect(state.titleInserts).toHaveLength(0);
    expect(state.titleUpdates).toHaveLength(2);
    expect(result.counts.titles).toBe(0);
    expect(result.counts.titlesUpdated).toBe(2);
    expect(result.counts.passages).toBe(1);
  });
});

describe('applyImportPreview leftover import passages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSavePassages.mockResolvedValue({ success: true } as never);
  });

  const passageOps: ImportOperationInput[] = [
    {
      kind: 'upsert_passage',
      passage: { label: '', type: 'translation', content: 'a' },
    },
  ];

  it('warns about passages an earlier, longer import left', async () => {
    const [saved] = passageUuids(normalizeImportOperations('w1', passageOps));
    const state: FakeState = {
      importedPassages: [
        { uuid: saved, xmlId: 'docx-0' },
        { uuid: importPassageUuid('w1', 'docx-1'), xmlId: 'docx-1' },
        { uuid: importPassageUuid('w1', 'docx-2'), xmlId: 'docx-2' },
      ],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: passageOps,
    });

    expect(result.warnings).toEqual([
      expect.stringContaining('2 passage(s) saved by an earlier import'),
    ]);
    expect(result.warnings[0]).toContain('docx-1, docx-2');
  });

  it('does not look for leftovers when every passage carries its uuid', async () => {
    const state: FakeState = {
      importedPassages: [
        { uuid: importPassageUuid('w1', 'docx-1'), xmlId: 'docx-1' },
      ],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: [
        {
          kind: 'upsert_passage',
          passage: {
            uuid: 'stored',
            label: '',
            type: 'translation',
            content: 'a',
          },
        },
      ],
    });

    expect(result.warnings).toEqual([]);
  });

  const threeOps: ImportOperationInput[] = ['a', 'b', 'c'].map((content) => ({
    kind: 'upsert_passage',
    passage: { label: '', type: 'translation', content },
  }));

  it('refuses to overwrite imported passages an edit has reordered', async () => {
    const state: FakeState = {
      titleInserts: [],
      storedPassages: [
        { uuid: importPassageUuid('w1', 'docx-0'), sort: 0 },
        { uuid: importPassageUuid('w1', 'docx-1'), sort: 2 },
        { uuid: importPassageUuid('w1', 'docx-2'), sort: 1 },
      ],
    };

    await expect(
      applyImportPreview({
        client: makeFakeClient(state),
        workUuid: 'w1',
        operations: [
          { kind: 'upsert_title', title: { content: 't', type: 'mainTitle' } },
          ...threeOps,
        ],
      }),
    ).rejects.toThrow('1 passage(s) would overwrite');
    expect(mockedSavePassages).not.toHaveBeenCalled();
    expect(state.titleInserts).toEqual([]);
  });

  it('updates imported passages an insert has shifted but not reordered', async () => {
    const state: FakeState = {
      storedPassages: [
        { uuid: importPassageUuid('w1', 'docx-0'), sort: 0 },
        { uuid: importPassageUuid('w1', 'docx-1'), sort: 2 },
        { uuid: importPassageUuid('w1', 'docx-2'), sort: 3 },
      ],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: threeOps,
    });

    expect(result.counts.passages).toBe(3);
  });

  it('accepts passages sharing a sort that an earlier run saved in either order', async () => {
    // The second run of a failed import places the tied passage below the
    // one already saved; the third run must not call that a move.
    const ops: ImportOperationInput[] = [
      {
        kind: 'upsert_passage',
        passage: { label: '', type: 'translation', content: 'a' },
      },
      {
        kind: 'upsert_passage',
        passage: { label: '', type: 'translation', content: 'b', sort: 0 },
      },
    ];
    const [first, second] = passageUuids(normalizeImportOperations('w1', ops));
    const state: FakeState = {
      storedPassages: [
        { uuid: first, sort: 1 },
        { uuid: second, sort: 0 },
      ],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: ops,
    });

    expect(result.counts.passages).toBe(2);
  });

  it('updates an imported passage still at its position', async () => {
    const state: FakeState = {
      storedPassages: [{ uuid: importPassageUuid('w1', 'docx-0'), sort: 0 }],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: passageOps,
    });

    expect(result.counts.passages).toBe(1);
    expect(mockedSavePassages).toHaveBeenCalledTimes(1);
  });

  it('says nothing when no earlier import passages are left', async () => {
    const [saved] = passageUuids(normalizeImportOperations('w1', passageOps));
    const state: FakeState = {
      importedPassages: [{ uuid: saved, xmlId: 'docx-0' }],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: passageOps,
    });

    expect(result.warnings).toEqual([]);
  });

  it('refuses to re-run over passages an earlier import saved under random uuids', async () => {
    const state: FakeState = {
      titleInserts: [],
      importedPassages: [{ uuid: 'random', xmlId: 'docx-0' }],
    };

    await expect(
      applyImportPreview({
        client: makeFakeClient(state),
        workUuid: 'w1',
        operations: [
          { kind: 'upsert_title', title: { content: 't', type: 'mainTitle' } },
          ...passageOps,
        ],
      }),
    ).rejects.toThrow('would add a second copy of them');
    expect(mockedSavePassages).not.toHaveBeenCalled();
    expect(state.titleInserts).toEqual([]);
  });

  it('matches leftovers saved under a repeated xmlId', async () => {
    const state: FakeState = {
      importedPassages: [
        { uuid: importPassageUuid('w1', 'docx-5'), xmlId: 'docx-5' },
        { uuid: importPassageUuid('w1', 'docx-5', 2), xmlId: 'docx-5' },
      ],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: passageOps,
    });

    expect(result.warnings).toEqual([
      expect.stringContaining('2 passage(s) saved by an earlier import'),
    ]);
  });

  it('matches a leftover whose earlier occurrence of the xmlId was deleted', async () => {
    const state: FakeState = {
      importedPassages: [
        { uuid: importPassageUuid('w1', 'docx-5', 2), xmlId: 'docx-5' },
      ],
    };

    const result = await applyImportPreview({
      client: makeFakeClient(state),
      workUuid: 'w1',
      operations: passageOps,
    });

    expect(result.warnings).toEqual([
      expect.stringContaining('1 passage(s) saved by an earlier import'),
    ]);
  });

  it('refuses when the earlier import passages cannot be read', async () => {
    await expect(
      applyImportPreview({
        client: makeFakeClient({ failImportedRead: true }),
        workUuid: 'w1',
        operations: passageOps,
      }),
    ).rejects.toThrow('Nothing was saved');
    expect(mockedSavePassages).not.toHaveBeenCalled();
  });
});

describe('applyImportPreview annotation uuids held by another passage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSavePassages.mockResolvedValue({ success: true } as never);
  });

  const ops: ImportOperationInput[] = [
    {
      kind: 'upsert_passage',
      passage: { label: '', type: 'translation', content: 'Thus have I heard.' },
      annotations: [{ kind: 'paragraph', start: 0, end: 18 }],
    },
  ];
  const derivedUuid = () => {
    const [operation] = normalizeImportOperations('w1', ops);
    return previewDtoToPassage(operation as PassageInsertOperation)
      .annotations[0].uuid;
  };
  const saved = () =>
    mockedSavePassages.mock.calls[0][0].passages[0].annotations[0].uuid;

  it('saves a new uuid rather than take the row from the other passage', async () => {
    const taken = derivedUuid();
    const result = await applyImportPreview({
      client: makeFakeClient({
        storedAnnotations: [{ uuid: taken, passage_uuid: 'other-passage' }],
      }),
      workUuid: 'w1',
      operations: ops,
    });

    expect(saved()).not.toBe(taken);
    expect(isUuid(saved())).toBe(true);
    expect(result.warnings).toEqual([
      expect.stringContaining('1 annotation(s)'),
    ]);
  });

  it('keeps the derived uuid of a row already on its own passage', async () => {
    const taken = derivedUuid();
    const [operation] = normalizeImportOperations('w1', ops);
    const result = await applyImportPreview({
      client: makeFakeClient({
        storedAnnotations: [
          {
            uuid: taken,
            passage_uuid: (operation as PassageInsertOperation).passage.uuid,
          },
        ],
      }),
      workUuid: 'w1',
      operations: ops,
    });

    expect(saved()).toBe(taken);
    expect(result.warnings).toEqual([]);
  });
});

describe('summarizeImportOperations', () => {
  it('counts each operation kind and annotations', () => {
    const counts = summarizeImportOperations(
      normalizeImportOperations('w', [
        { kind: 'update_work', patch: { toh: 'toh1' } },
        { kind: 'upsert_title', title: { content: 't', type: 'mainTitle' } },
        { kind: 'update_folio_annotation', patch: { source_description: 's' } },
        {
          kind: 'upsert_passage',
          passage: { label: '1', type: 'translation', content: 'c' },
          annotations: [
            { kind: 'span', start: 0, end: 1, data: { textStyle: 'emphasis' } },
          ],
        },
      ]),
    );

    expect(counts).toEqual({
      titles: 1,
      passages: 1,
      annotations: 1,
      workUpdates: 1,
      folioUpdates: 1,
    });
  });
});
