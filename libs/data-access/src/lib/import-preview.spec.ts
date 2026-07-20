jest.mock('./passage', () => ({
  savePassagesWithDeletions: jest.fn(),
}));

import {
  applyImportPreview,
  normalizeImportOperations,
  summarizeImportOperations,
} from './import-preview';
import { savePassagesWithDeletions } from './passage';
import type { DataClient, ImportOperationInput } from './types';

const mockedSavePassages = jest.mocked(savePassagesWithDeletions);

/**
 * Minimal chainable Supabase stub. `from(table)` returns a thenable builder
 * whose resolved value depends on the table and the terminal operation, so the
 * persistence functions see the counts / rows configured in `state`.
 */
interface FakeState {
  passagesCount?: number;
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
        then(resolve: (value: unknown) => unknown) {
          let result: unknown = { data: [], count: 0, error: null };
          if (ctx.table === 'passages' && ctx.op === 'select') {
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
    kind: 'insert_title',
    title: { content: 'བཅོམ་ལྡན་འདས།', type: 'mainTitle', language: 'bo' },
  },
  {
    kind: 'insert_title',
    title: { content: 'The Blessed One', type: 'mainTitle', language: 'en' },
  },
  {
    kind: 'insert_passage',
    passage: { label: '1', type: 'translation', content: 'Thus have I heard.' },
  },
];

describe('normalizeImportOperations', () => {
  const workUuid = 'work-123';

  it('fills the owning work and generates a uuid for titles', () => {
    const [op] = normalizeImportOperations(workUuid, [
      {
        kind: 'insert_title',
        title: { content: 'The Blessed One', type: 'mainTitle', language: 'en' },
      },
    ]);

    if (op.kind !== 'insert_title') throw new Error('expected insert_title');
    expect(op.title.workUuid).toBe(workUuid);
    expect(op.title.uuid).toEqual(expect.any(String));
    expect(op.title.content).toBe('The Blessed One');
  });

  it('assigns monotonic sort and derived xmlId to passages in source order', () => {
    const ops = normalizeImportOperations(workUuid, [
      { kind: 'insert_passage', passage: { label: '1', type: 'translation', content: 'a' } },
      { kind: 'insert_passage', passage: { label: '2', type: 'translation', content: 'b' } },
    ]);

    const passages = ops.filter((o) => o.kind === 'insert_passage');
    expect(passages.map((o) => (o.kind === 'insert_passage' ? o.passage.sort : -1))).toEqual([
      0, 1,
    ]);
    expect(passages.map((o) => (o.kind === 'insert_passage' ? o.passage.xmlId : ''))).toEqual([
      'docx-0',
      'docx-1',
    ]);
  });

  it('respects an explicit passage sort and continues from it', () => {
    const ops = normalizeImportOperations(workUuid, [
      { kind: 'insert_passage', passage: { label: '1', type: 'translation', content: 'a', sort: 5 } },
      { kind: 'insert_passage', passage: { label: '2', type: 'translation', content: 'b' } },
    ]);
    const sorts = ops.map((o) => (o.kind === 'insert_passage' ? o.passage.sort : -1));
    expect(sorts).toEqual([5, 6]);
  });

  it('defaults passage annotations to an empty array', () => {
    const [op] = normalizeImportOperations(workUuid, [
      { kind: 'insert_passage', passage: { label: '1', type: 'summary', content: 'x' } },
    ]);
    if (op.kind !== 'insert_passage') throw new Error('expected insert_passage');
    expect(op.annotations).toEqual([]);
  });

  it('passes update_work and upsert_folio_annotation through unchanged', () => {
    const input: ImportOperationInput[] = [
      { kind: 'update_work', patch: { toh: 'toh44' } },
      { kind: 'upsert_folio_annotation', patch: { source_description: 'Degé Kangyur' } },
    ];
    expect(normalizeImportOperations(workUuid, input)).toEqual(input);
  });
});

describe('applyImportPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSavePassages.mockResolvedValue({ success: true } as never);
  });

  it('inserts all titles when the work has none yet', async () => {
    const state: FakeState = { passagesCount: 0, titleRows: [], titleInserts: [] };
    const client = makeFakeClient(state);

    const result = await applyImportPreview({ client, workUuid: 'w1', operations: sampleOps });

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
        { uuid: 't-bo', type: 'mainTitle', language: 'bo', content: 'stale bo title' },
      ],
      titleInserts: [],
    };
    const client = makeFakeClient(state);

    const result = await applyImportPreview({ client, workUuid: 'w1', operations: sampleOps });

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
        { uuid: 't-bo', type: 'mainTitle', language: 'bo', content: 'stale bo' },
        { uuid: 't-en', type: 'mainTitle', language: 'en', content: 'stale en' },
      ],
      titleInserts: [],
    };
    const client = makeFakeClient(state);

    const result = await applyImportPreview({ client, workUuid: 'w1', operations: sampleOps });

    expect(state.titleInserts).toHaveLength(0);
    expect(state.titleUpdates).toHaveLength(2);
    expect(result.counts.titles).toBe(0);
    expect(result.counts.titlesUpdated).toBe(2);
    expect(result.counts.passages).toBe(1);
  });

  it('throws when the work already has passages', async () => {
    const client = makeFakeClient({ passagesCount: 12 });

    await expect(
      applyImportPreview({ client, workUuid: 'w1', operations: sampleOps }),
    ).rejects.toThrow('already contains passages');
    expect(mockedSavePassages).not.toHaveBeenCalled();
  });
});

describe('summarizeImportOperations', () => {
  it('counts each operation kind and annotations', () => {
    const counts = summarizeImportOperations(
      normalizeImportOperations('w', [
        { kind: 'update_work', patch: { toh: 'toh1' } },
        { kind: 'insert_title', title: { content: 't', type: 'mainTitle' } },
        { kind: 'upsert_folio_annotation', patch: { source_description: 's' } },
        {
          kind: 'insert_passage',
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
