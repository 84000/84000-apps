import { savePassagesWithDeletions } from './save';
import type { AnnotationDTO, Passage, PassageRowDTO } from '../types';

type TableName = 'passages' | 'passage_annotations';

/**
 * Operation names recorded in `state.ops` and accepted by `state.failOn`:
 * - rpc:shift_passage_sorts
 * - select:passages / select:passages:labels / select:passages:sorts /
 *   select:passages:deleted / select:passages:saved / select:annotations /
 *   select:annotations:endnote-refs
 * - upsert:passages / upsert:passages:labels / upsert:annotations
 * - delete:passages / delete:annotations / delete:annotations:by-passage
 */
type FakeState = {
  annotations: AnnotationDTO[];
  deletedAnnotationUuids: string[];
  deletedPassageUuids: string[];
  passageUpserts: PassageRowDTO[][];
  labelUpserts: { uuid: string; label: string }[][];
  passages: PassageRowDTO[];
  annotationUpserts: AnnotationDTO[][];
  ops: string[];
  failOn?: Partial<Record<string, string>>;
  /** Rows a delete silently skips, as row-level security does. */
  protectedUuids: Set<string>;
  /** Annotations removed by someone else just before any delete runs. */
  vanishOnDelete: Set<string>;
  /** The longest `in` list any request carried. */
  maxInLength: number;
};

const failResult = (state: FakeState, op: string) => {
  const message = state.failOn?.[op];
  return message ? { message } : null;
};

/** Rows after an upsert: matching uuids replaced, the rest appended. */
const upsertInto = <T extends { uuid: string }>(stored: T[], rows: T[]) => {
  const byUuid = new Map(rows.map((row) => [row.uuid, row]));
  const kept = stored.map((row) => byUuid.get(row.uuid) ?? row);
  const storedUuids = new Set(stored.map((row) => row.uuid));
  return [...kept, ...rows.filter((row) => !storedUuids.has(row.uuid))];
};

/** PostgREST returns at most this many rows when no range is given. */
const MAX_ROWS = 1000;

class FakeQueryBuilder {
  private action?: 'select' | 'delete';
  private inColumn?: string;
  private inValues: string[] = [];
  private eqType?: string;
  private eqWorkUuid?: string;
  private rangeFrom?: number;
  private rangeTo?: number;
  private returning = false;
  private filterContentUuid?: string;

  constructor(
    private readonly state: FakeState,
    private readonly table: TableName,
  ) {}

  private columns?: string;

  select(columns?: string) {
    if (this.action === 'delete') {
      this.returning = true;
      return this;
    }
    this.action = 'select';
    this.columns = columns;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(rows: PassageRowDTO[] | AnnotationDTO[]) {
    if (this.table === 'passages') {
      const isLabelOnly = (rows as { uuid: string }[]).every(
        (row) => Object.keys(row).sort().join(',') === 'label,uuid',
      );
      const op = isLabelOnly ? 'upsert:passages:labels' : 'upsert:passages';
      this.state.ops.push(op);
      const error = failResult(this.state, op);
      if (error) {
        return Promise.resolve({ error });
      }
      if (isLabelOnly) {
        const labels = rows as { uuid: string; label: string }[];
        this.state.labelUpserts.push(labels);
        const byUuid = new Map(labels.map((row) => [row.uuid, row.label]));
        this.state.passages = this.state.passages.map((row) =>
          byUuid.has(row.uuid)
            ? { ...row, label: byUuid.get(row.uuid) as string }
            : row,
        );
      } else {
        this.state.passageUpserts.push(rows as PassageRowDTO[]);
        this.state.passages = upsertInto(
          this.state.passages,
          rows as PassageRowDTO[],
        );
      }
    } else {
      this.state.ops.push('upsert:annotations');
      const error = failResult(this.state, 'upsert:annotations');
      if (error) {
        return Promise.resolve({ error });
      }
      this.state.annotationUpserts.push(rows as AnnotationDTO[]);
      this.state.annotations = upsertInto(
        this.state.annotations,
        rows as AnnotationDTO[],
      );
    }
    return Promise.resolve({ error: null });
  }

  in(column: string, values: string[]) {
    this.inColumn = column;
    this.inValues = values;
    this.state.maxInLength = Math.max(this.state.maxInLength, values.length);
    return this;
  }

  not() {
    return this;
  }

  eq(column: string, value: string) {
    if (column === 'type') {
      this.eqType = value;
    }
    if (column === 'work_uuid') {
      this.eqWorkUuid = value;
    }
    return this;
  }

  filter(column: string, op: string, value: string) {
    if (column === 'content' && op === 'cs') {
      try {
        const parsed = JSON.parse(value) as Array<{ uuid?: string }>;
        this.filterContentUuid = parsed[0]?.uuid;
      } catch {
        // ignore malformed filter values in the fake client
      }
    }
    return this;
  }

  neq() {
    return this;
  }

  order() {
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  private paged<T>(rows: T[]): T[] {
    return this.rangeFrom === undefined
      ? rows.slice(0, MAX_ROWS)
      : rows.slice(this.rangeFrom, (this.rangeTo as number) + 1);
  }

  private opName(): string {
    if (this.action === 'delete') {
      if (this.table === 'passages') {
        return 'delete:passages';
      }
      return this.inColumn === 'passage_uuid'
        ? 'delete:annotations:by-passage'
        : 'delete:annotations';
    }

    if (this.table === 'passages') {
      if (this.columns === 'uuid, sort') return 'select:passages:sorts';
      if (this.columns === 'uuid, sort, label, toh') {
        return 'select:passages:labels';
      }
      if (this.columns === 'uuid, sort, label, work_uuid') {
        return 'select:passages:deleted';
      }
      return this.columns?.startsWith('uuid, work_uuid')
        ? 'select:passages:saved'
        : 'select:passages';
    }
    return this.filterContentUuid
      ? 'select:annotations:endnote-refs'
      : 'select:annotations';
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown[] | null;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const op = this.opName();
    this.state.ops.push(op);
    const error = failResult(this.state, op);
    if (error) {
      return { data: null, error };
    }

    if (this.action === 'delete') {
      // Another save got there first.
      const vanished = this.state.vanishOnDelete;
      this.state.annotations = this.state.annotations.filter(
        (annotation) => !vanished.has(annotation.uuid),
      );
      const permitted = (uuid: string) => !this.state.protectedUuids.has(uuid);
      let removed: string[];
      if (this.table === 'passage_annotations') {
        removed = this.state.annotations
          .filter((annotation) =>
            this.inValues.includes(
              (this.inColumn === 'passage_uuid'
                ? annotation.passage_uuid
                : annotation.uuid) ?? '',
            ),
          )
          .map((annotation) => annotation.uuid)
          .filter(permitted);
        this.state.deletedAnnotationUuids.push(...removed);
        this.state.annotations = this.state.annotations.filter(
          (annotation) => !removed.includes(annotation.uuid),
        );
      } else {
        // The annotation foreign key is ON DELETE RESTRICT.
        if (
          this.state.annotations.some((annotation) =>
            this.inValues.includes(annotation.passage_uuid ?? ''),
          )
        ) {
          return {
            data: null,
            error: { message: 'violates foreign key constraint' },
          };
        }
        removed = this.state.passages
          .map((passage) => passage.uuid)
          .filter((uuid) => this.inValues.includes(uuid))
          .filter(permitted);
        this.state.deletedPassageUuids.push(...removed);
        this.state.passages = this.state.passages.filter(
          (passage) => !removed.includes(passage.uuid),
        );
      }
      return {
        data: this.returning ? removed.map((uuid) => ({ uuid })) : null,
        error: null,
      };
    }

    if (this.table === 'passage_annotations') {
      if (this.filterContentUuid) {
        return {
          data: this.paged(
            this.state.annotations.filter(
              (annotation) =>
                (!this.eqType || annotation.type === this.eqType) &&
                Array.isArray(annotation.content) &&
                annotation.content.some(
                  (entry) =>
                    (entry as { uuid?: string })?.uuid ===
                    this.filterContentUuid,
                ),
            ),
          ),
          error: null,
        };
      }
      return {
        data: this.paged(
          this.state.annotations
            .filter((annotation) =>
              this.inValues.includes(
                (this.inColumn === 'uuid'
                  ? annotation.uuid
                  : annotation.passage_uuid) ?? '',
              ),
            )
            .sort(
              (a, b) =>
                (a.passage_uuid ?? '').localeCompare(b.passage_uuid ?? '') ||
                a.uuid.localeCompare(b.uuid),
            ),
        ),
        error: null,
      };
    }

    if (op === 'select:passages:labels') {
      return {
        data: this.paged(
          this.state.passages
            .filter(
              (passage) =>
                passage.work_uuid === this.eqWorkUuid && passage.label,
            )
            .sort((a, b) => a.sort - b.sort || a.uuid.localeCompare(b.uuid)),
        ),
        error: null,
      };
    }

    return {
      data: this.inColumn
        ? this.state.passages.filter((passage) =>
            this.inValues.includes(passage.uuid),
          )
        : [],
      error: null,
    };
  }
}

const createFakeClient = (state: FakeState) =>
  ({
    from: (table: TableName) => new FakeQueryBuilder(state, table),
    rpc: (
      name: string,
      args?: { p_work_uuid?: string; p_from_sort?: number; p_delta?: number },
    ) => {
      const op = `rpc:${name}`;
      state.ops.push(op);
      const error = failResult(state, op);
      if (!error && name === 'shift_passage_sorts' && args) {
        // The migration's rule: the contiguous run of distinct sorts starting
        // at `p_from_sort` moves up by `p_delta`.
        const inWork = state.passages.filter(
          (row) => row.work_uuid === args.p_work_uuid,
        );
        const occupied = new Set(inWork.map((row) => row.sort));
        let end = args.p_from_sort as number;
        while (occupied.has(end)) end++;
        state.passages = state.passages.map((row) =>
          row.work_uuid === args.p_work_uuid &&
          row.sort >= (args.p_from_sort as number) &&
          row.sort < end
            ? { ...row, sort: row.sort + (args.p_delta as number) }
            : row,
        );
      }
      return Promise.resolve({ error });
    },
  }) as never;

const createState = ({
  annotations = [],
  passages = [],
  failOn,
  protectedUuids = [],
}: {
  annotations?: AnnotationDTO[];
  passages?: PassageRowDTO[];
  failOn?: Partial<Record<string, string>>;
  protectedUuids?: string[];
}): FakeState => ({
  annotations,
  deletedAnnotationUuids: [],
  deletedPassageUuids: [],
  passageUpserts: [],
  labelUpserts: [],
  passages,
  annotationUpserts: [],
  ops: [],
  failOn,
  protectedUuids: new Set(protectedUuids),
  vanishOnDelete: new Set(),
  maxInLength: 0,
});

const passage: Passage = {
  uuid: 'passage-1',
  workUuid: 'work-1',
  content: 'Body text',
  label: '1',
  sort: 1,
  type: 'translation',
  annotations: [
    {
      uuid: 'annotation-1',
      passageUuid: 'passage-1',
      start: 0,
      end: 9,
      type: 'paragraph',
    },
  ],
};

const passageRow: PassageRowDTO = {
  uuid: 'passage-1',
  work_uuid: 'work-1',
  content: 'Body text',
  label: '1',
  sort: 1,
  type: 'translation',
};

const annotationRow: AnnotationDTO = {
  uuid: 'annotation-1',
  passage_uuid: 'passage-1',
  start: 0,
  end: 9,
  type: 'paragraph',
  content: [],
};

describe('savePassagesWithDeletions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not upsert unchanged passage or annotation rows', async () => {
    const state = createState({
      annotations: [annotationRow],
      passages: [passageRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(true);
    expect(state.passageUpserts).toEqual([]);
    expect(state.annotationUpserts).toEqual([]);
    expect(state.deletedAnnotationUuids).toEqual([]);
  });

  it('upserts only changed annotations for dirty passages', async () => {
    const state = createState({
      annotations: [{ ...annotationRow, end: 4 }],
      passages: [passageRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(true);
    expect(state.passageUpserts).toEqual([]);
    // Complete rows: an absent `toh` is written as null, not omitted.
    expect(state.annotationUpserts).toEqual([
      [{ ...annotationRow, toh: null }],
    ]);
    expect(state.deletedAnnotationUuids).toEqual([]);
  });

  it('deletes annotations omitted from a saved dirty passage', async () => {
    const state = createState({
      annotations: [
        annotationRow,
        { ...annotationRow, uuid: 'annotation-2', start: 5, end: 9 },
      ],
      passages: [passageRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(true);
    expect(state.annotationUpserts).toEqual([]);
    expect(state.deletedAnnotationUuids).toEqual(['annotation-2']);
  });

  it('supports delete-only saves without passage or annotation upserts', async () => {
    const state = createState({
      annotations: [annotationRow],
      passages: [passageRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['passage-1'],
    });

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);
    expect(state.passageUpserts).toEqual([]);
    expect(state.annotationUpserts).toEqual([]);
    expect(state.deletedAnnotationUuids).toEqual(['annotation-1']);
    expect(state.deletedPassageUuids).toEqual(['passage-1']);
  });

  it('cascades deletion of endnote-link references on other passages', async () => {
    const referencingAnnotation: AnnotationDTO = {
      uuid: 'ref-1',
      passage_uuid: 'passage-translation',
      start: 9,
      end: 9,
      type: 'end-note-link',
      content: [{ uuid: 'endnote-1' }],
    };

    const endnoteRow: PassageRowDTO = {
      uuid: 'endnote-1',
      work_uuid: 'work-1',
      content: 'Note text',
      label: '1',
      sort: 5,
      type: 'endnotes',
    };

    const state = createState({
      annotations: [referencingAnnotation],
      passages: [endnoteRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['endnote-1'],
    });

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);
    expect(state.deletedPassageUuids).toEqual(['endnote-1']);
    // The reference lives on a different passage, so it is only removed via
    // the content-containment cascade, not the delete-by-passage_uuid pass.
    expect(state.deletedAnnotationUuids).toEqual(['ref-1']);
  });
});

describe('savePassagesWithDeletions sort shifts', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const row = (uuid: string, sort: number): PassageRowDTO => ({
    uuid,
    work_uuid: 'work-1',
    content: uuid,
    label: uuid,
    sort,
    type: 'translation',
  });
  const edited = (uuid: string, sort: number): Passage => ({
    uuid,
    workUuid: 'work-1',
    content: `${uuid} edited`,
    label: uuid,
    sort,
    type: 'translation',
    annotations: [],
  });

  // Rows are read before the shift. Writing an edited passage's pre-shift
  // sort back over the shifted one tied it with the new passage.
  it('keeps the shifted sort of an edited passage inside the shifted run', async () => {
    const state = createState({
      passages: [row('a', 169), row('b', 170), row('c', 171)],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [edited('b', 170), edited('new', 170)],
    });

    expect(result.success).toBe(true);
    const upserted = new Map(
      state.passageUpserts.flat().map((upsert) => [upsert.uuid, upsert.sort]),
    );
    expect(upserted.get('new')).toBe(170);
    expect(upserted.get('b')).toBe(171);
  });

  it('fails the save when the shifted sorts cannot be read', async () => {
    const state = createState({
      passages: [row('a', 169), row('b', 170)],
      failOn: { 'select:passages:sorts': 'read failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [edited('b', 170), edited('new', 170)],
    });

    expect(result.success).toBe(false);
    expect(state.passageUpserts).toEqual([]);
  });

  it('does not re-read sorts when nothing is inserted', async () => {
    const state = createState({ passages: [row('a', 169)] });

    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [edited('a', 169)],
    });

    expect(state.ops).not.toContain('select:passages:sorts');
  });

  // A client holding a sort from before a shift (a retry after a failed
  // save, or a neighbour it never reloaded) must not move the passage back.
  it('keeps the stored sort of an existing passage whatever the client sent', async () => {
    const state = createState({
      passages: [row('a', 169), row('b', 170), row('c', 180)],
    });

    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [edited('c', 175), edited('new', 170)],
    });

    const upserted = new Map(
      state.passageUpserts.flat().map((upsert) => [upsert.uuid, upsert.sort]),
    );
    expect(upserted.get('new')).toBe(170);
    expect(upserted.get('c')).toBe(180);
  });

  it('does not tie a retried passage with the one a failed save made room for', async () => {
    const state = createState({
      passages: [row('b', 1), row('c', 2)],
      failOn: { 'upsert:passages': 'commit failed' },
    });
    const save = () =>
      savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [edited('b', 1), edited('x', 1)],
      });

    expect((await save()).success).toBe(false);
    state.failOn = undefined;
    expect((await save()).success).toBe(true);

    const sorts = new Map(state.passages.map((r) => [r.uuid, r.sort]));
    state.passageUpserts.flat().forEach((r) => sorts.set(r.uuid, r.sort));
    expect(sorts.get('x')).toBe(1);
    expect(sorts.get('b')).toBe(2);
  });

  it('does not move a passage the client last saw before a shift', async () => {
    const state = createState({ passages: [row('b', 1)] });
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [edited('x', 1)],
    });
    // The client never reloaded b, so still holds sort 1.
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [{ ...edited('b', 1), content: 'b again' }],
    });

    const bUpserts = state.passageUpserts.flat().filter((r) => r.uuid === 'b');
    expect(bUpserts.map((r) => r.sort)).toEqual([2]);
  });
});

describe('savePassagesWithDeletions placing new passages', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const row = (uuid: string, sort: number): PassageRowDTO => ({
    uuid,
    work_uuid: 'work-1',
    content: uuid,
    label: uuid,
    sort,
    type: 'translation',
  });
  const created = (uuid: string, sort: number): Passage => ({
    uuid,
    workUuid: 'work-1',
    content: `${uuid} new`,
    label: uuid,
    sort,
    type: 'translation',
    annotations: [],
  });

  /** Every row after the save, in stored order, as `uuid:sort`. */
  const stored = (state: FakeState) => {
    const rows = new Map(state.passages.map((r) => [r.uuid, r.sort]));
    state.passageUpserts.flat().forEach((r) => rows.set(r.uuid, r.sort));
    return [...rows.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([uuid, sort]) => `${uuid}:${sort}`);
  };

  const dense = () =>
    createState({
      passages: [row('p', 170), row('q', 171), row('r', 172), row('s', 176)],
    });

  // Two consecutive splits of p. Without anchors this ended with n2 and q
  // both at 172.
  it('places a run of new passages after the passage they follow', async () => {
    const state = dense();
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('n1', 171), created('n2', 172)],
      anchors: { n1: { after: 'p' }, n2: { after: 'p' } },
    });
    expect(stored(state)).toEqual([
      'p:170',
      'n1:171',
      'n2:172',
      'q:173',
      'r:174',
      's:176',
    ]);
  });

  // The same sorts as the case above, a different intent: one after p, one
  // after q.
  it('tells apart new passages after neighbouring passages', async () => {
    const state = dense();
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('a', 171), created('b', 172)],
      anchors: { a: { after: 'p' }, b: { after: 'q' } },
    });
    expect(stored(state)).toEqual([
      'p:170',
      'a:171',
      'q:172',
      'b:173',
      'r:174',
      's:176',
    ]);
  });

  it('places a new passage with nothing saved before it where it was sent', async () => {
    const state = dense();
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('first', 170)],
      anchors: { first: null },
    });
    expect(stored(state)).toEqual([
      'first:170',
      'p:171',
      'q:172',
      'r:173',
      's:176',
    ]);
  });

  it('places a new passage first in its section before the passage it precedes', async () => {
    const state = dense();
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('first', 999)],
      anchors: { first: { before: 'q' } },
    });
    expect(stored(state)).toEqual([
      'p:170',
      'first:171',
      'q:172',
      'r:173',
      's:176',
    ]);
  });

  // One group for every unanchored passage packed a new endnote and a new
  // bibliography passage together, three hundred sorts from the second.
  it('keeps unanchored passages apart, each at its own sort', async () => {
    const state = createState({
      passages: [row('t', 170), row('u', 171), row('b1', 500)],
    });
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('e', 171), created('bib', 500)],
      anchors: { e: null, bib: null },
    });
    expect(stored(state)).toEqual([
      't:170',
      'e:171',
      'u:172',
      'bib:500',
      'b1:501',
    ]);
  });

  // Per-text variants of one note share a sort. Placing after each gave
  // both new passages the slot after it.
  it('does not give two anchors sharing a sort the same slot', async () => {
    const state = createState({
      passages: [row('a', 305), row('b', 305), row('c', 306)],
    });
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('x', 306), created('y', 306)],
      anchors: { x: { after: 'a' }, y: { after: 'b' } },
    });
    expect(stored(state)).toEqual([
      'a:305',
      'b:305',
      'x:306',
      'y:307',
      'c:308',
    ]);
  });

  // The last body passage and the first endnote, each gaining a neighbour
  // in the gap between them. Placed before-group first, the new body
  // passage landed after the new endnote.
  it('puts a passage after one ahead of a passage before the next', async () => {
    const state = createState({
      passages: [row('last', 170), row('note', 171)],
    });
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      // The endnote first, as a spine holding the Endnotes tab first sends it.
      passages: [created('newNote', 171), created('newBody', 171)],
      anchors: { newNote: { before: 'note' }, newBody: { after: 'last' } },
    });
    expect(stored(state)).toEqual([
      'last:170',
      'newBody:171',
      'newNote:172',
      'note:173',
    ]);
  });

  it('makes room for more passages than the gap after the anchor', async () => {
    const state = createState({
      passages: [row('p', 170), row('q', 171), row('r', 173)],
    });
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('n1', 171), created('n2', 172), created('n3', 173)],
      anchors: {
        n1: { after: 'p' },
        n2: { after: 'p' },
        n3: { after: 'p' },
      },
    });
    expect(stored(state)).toEqual([
      'p:170',
      'n1:171',
      'n2:172',
      'n3:173',
      'q:174',
      'r:175',
    ]);
  });

  it('falls back to the sent sort when the anchor is not stored', async () => {
    const state = dense();
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('n', 172)],
      anchors: { n: { after: 'missing' } },
    });
    expect(stored(state)).toEqual([
      'p:170',
      'q:171',
      'n:172',
      'r:173',
      's:176',
    ]);
  });

  it('keeps the old placement when a new passage has no anchor given', async () => {
    const state = dense();
    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('n1', 171)],
      anchors: {},
    });
    expect(stored(state)).toEqual([
      'p:170',
      'n1:171',
      'q:172',
      'r:173',
      's:176',
    ]);
  });
});

describe('savePassagesWithDeletions failure propagation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const newPassage: Passage = {
    ...passage,
    uuid: 'passage-new',
    sort: 2,
    label: '2',
    annotations: [],
  };

  it('aborts before any content writes when shift_passage_sorts fails', async () => {
    const state = createState({
      passages: [],
      failOn: { 'rpc:shift_passage_sorts': 'shift failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [newPassage],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('shift');
    expect(state.ops).not.toContain('upsert:passages');
    expect(state.ops).not.toContain('delete:passages');
  });

  it('surfaces passage upsert failures', async () => {
    const state = createState({
      passages: [passageRow],
      failOn: { 'upsert:passages': 'upsert failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [{ ...passage, content: 'Changed text' }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to save passages');
    expect(state.ops).not.toContain('upsert:annotations');
  });

  it('commits content before renumbering and surfaces renumber failures', async () => {
    // A neighbor whose label must shift when the new passage is inserted.
    const neighbor: PassageRowDTO = {
      uuid: 'passage-neighbor',
      work_uuid: 'work-1',
      content: 'Neighbor',
      label: '2',
      sort: 3,
      type: 'translation',
    };
    const state = createState({
      passages: [neighbor],
      failOn: { 'upsert:passages:labels': 'renumber failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [newPassage],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('labels were not renumbered');
    // The content upsert committed before the renumber attempt.
    expect(state.ops.indexOf('upsert:passages')).toBeGreaterThanOrEqual(0);
    expect(state.ops.indexOf('upsert:passages')).toBeLessThan(
      state.ops.indexOf('upsert:passages:labels'),
    );
  });

  // A retry no longer sees the passage as new, so nothing would renumber
  // the series behind it again.
  it('writes what an insert renumbers before a delete that fails', async () => {
    const state = createState({
      passages: [
        { ...passageRow, uuid: 'neighbor', label: '2', sort: 3 },
        { ...passageRow, uuid: 'gone', label: '3', sort: 4 },
      ],
      failOn: { 'delete:passages': 'delete failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [newPassage],
      deletedUuids: ['gone'],
    });

    expect(result.success).toBe(false);
    const labels = Object.fromEntries(
      state.passages.map((row) => [row.uuid, row.label]),
    );
    // The deleted passage keeps the label the insert gave it, so a retry's
    // delete walk starts from the right number.
    expect(labels).toMatchObject({ neighbor: '3', gone: '4' });
  });

  it('writes what an insert renumbers before the annotations', async () => {
    const state = createState({
      passages: [{ ...passageRow, uuid: 'neighbor', label: '2', sort: 3 }],
      failOn: { 'upsert:annotations': 'annotations failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        {
          ...newPassage,
          annotations: passage.annotations.map((a) => ({
            ...a,
            uuid: 'annotation-new',
            passageUuid: 'passage-new',
          })),
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(state.passages.find((row) => row.uuid === 'neighbor')?.label).toBe(
      '3',
    );
  });

  it('plans labels per work when a save touches two', async () => {
    const state = createState({
      passages: [
        { ...passageRow, uuid: 'a2', label: '2', sort: 3 },
        { ...passageRow, uuid: 'b1', work_uuid: 'work-2', label: '1', sort: 1 },
        { ...passageRow, uuid: 'b2', work_uuid: 'work-2', label: '2', sort: 2 },
      ],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [newPassage],
      deletedUuids: ['b1'],
    });

    expect(result.success).toBe(true);
    expect(
      Object.fromEntries(state.passages.map((row) => [row.uuid, row.label])),
    ).toMatchObject({ 'passage-new': '2', a2: '3', b2: '1' });
  });

  it('keeps the stored toh of a payload passage that leaves it out when grouping variants', async () => {
    const state = createState({
      passages: [
        {
          ...passageRow,
          uuid: 'v1',
          label: 'n.2',
          sort: 3,
          toh: 'toh1' as never,
        },
        {
          ...passageRow,
          uuid: 'v2',
          label: 'n.2',
          sort: 3,
          toh: 'toh2' as never,
        },
        { ...passageRow, uuid: 'c', label: 'n.3', sort: 4 },
      ],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        { ...newPassage, label: 'n.2' },
        // Sent without its toh, as the GraphQL input does.
        {
          ...passage,
          uuid: 'v1',
          label: 'n.2',
          sort: 3,
          content: 'edited',
          annotations: [],
        },
      ],
    });

    expect(result.success).toBe(true);
    // Both variants still share one slot.
    expect(
      Object.fromEntries(state.passages.map((row) => [row.uuid, row.label])),
    ).toMatchObject({ v1: 'n.3', v2: 'n.3', c: 'n.4' });
  });

  it('aborts the deletion sequence while passages still exist when annotation cleanup fails', async () => {
    const state = createState({
      annotations: [annotationRow],
      passages: [passageRow],
      failOn: { 'delete:annotations:by-passage': 'cleanup failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['passage-1'],
    });

    expect(result.success).toBe(false);
    expect(state.ops).not.toContain('delete:passages');
    expect(state.deletedPassageUuids).toEqual([]);
  });

  it('writes renumbered labels only after the passage delete succeeds', async () => {
    const state = createState({
      annotations: [],
      passages: [
        passageRow,
        { ...passageRow, uuid: 'passage-2', label: '2', sort: 2 },
      ],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['passage-1'],
    });

    expect(result.success).toBe(true);
    expect(result.renumberedPassages).toEqual([
      { uuid: 'passage-2', label: '1' },
    ]);
    const deleteIndex = state.ops.indexOf('delete:passages');
    const labelsIndex = state.ops.indexOf('upsert:passages:labels');
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(labelsIndex).toBeGreaterThan(deleteIndex);
  });

  it('writes what a delete renumbers on a payload passage after the delete', async () => {
    const state = createState({
      annotations: [],
      passages: [
        { ...passageRow, uuid: 'gone', label: '2', sort: 2 },
        { ...passageRow, uuid: 'p3', label: '3', sort: 3 },
        { ...passageRow, uuid: 'p4', label: '4', sort: 4 },
      ],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        { ...passage, uuid: 'p3', label: '3', sort: 3, annotations: [] },
      ],
      deletedUuids: ['gone'],
    });

    expect(result.success).toBe(true);
    expect(state.labelUpserts.flat()).toEqual(
      expect.arrayContaining([
        { uuid: 'p3', label: '2' },
        { uuid: 'p4', label: '3' },
      ]),
    );
    expect(state.ops.indexOf('upsert:passages:labels')).toBeGreaterThan(
      state.ops.indexOf('delete:passages'),
    );
    expect(result.passages.find((row) => row.uuid === 'p3')?.label).toBe('2');
  });

  it('preserves stored annotations for passages with an incomplete export', async () => {
    const state = createState({
      annotations: [
        annotationRow,
        { ...annotationRow, uuid: 'annotation-2', start: 5, end: 9 },
      ],
      passages: [passageRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      // annotation-2 is absent from the payload, but the export is flagged
      // incomplete — the omission is a serialization gap, not a deletion.
      passages: [{ ...passage, annotationsIncomplete: true }],
    });

    expect(result.success).toBe(true);
    expect(state.deletedAnnotationUuids).toEqual([]);
  });

  it('still deletes omitted annotations of complete sibling passages', async () => {
    const completeSibling: Passage = {
      ...passage,
      uuid: 'passage-2',
      sort: 2,
      label: '2',
      annotations: [],
    };
    const siblingRow: PassageRowDTO = {
      ...passageRow,
      uuid: 'passage-2',
      sort: 2,
      label: '2',
    };

    const state = createState({
      annotations: [
        annotationRow,
        {
          ...annotationRow,
          uuid: 'annotation-sibling',
          passage_uuid: 'passage-2',
        },
      ],
      passages: [passageRow, siblingRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [{ ...passage, annotationsIncomplete: true }, completeSibling],
    });

    expect(result.success).toBe(true);
    // The incomplete passage's annotation survives; the complete sibling's
    // omitted annotation is deleted as a real removal.
    expect(state.deletedAnnotationUuids).toEqual(['annotation-sibling']);
  });

  it('reports failure when the orphaned annotation delete fails', async () => {
    const state = createState({
      annotations: [
        annotationRow,
        { ...annotationRow, uuid: 'annotation-2', start: 5, end: 9 },
      ],
      passages: [passageRow],
      failOn: { 'delete:annotations': 'orphan delete failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('stale annotations');
  });

  // DEV-720. The editor holds a window of a series, not all of it, so it can
  // only renumber the notes it has loaded. Those arrive already carrying their
  // expected label; treating that as "the rest of the series is contiguous"
  // stopped the walk at the edge of the window and left every note beyond it
  // sharing a number with its neighbour.
  describe('renumbering past the editor window', () => {
    /** n.843 inserted after n.842; the editor had n.843–n.844 loaded. */
    const insertedNote: Passage = {
      uuid: 'note-new',
      workUuid: 'work-1',
      content: '',
      label: 'n.843',
      sort: 843,
      type: 'endnotes',
      annotations: [],
    };

    /** The old n.843, renumbered by the client and sent in the payload. */
    const clientRenumbered: Passage = {
      ...insertedNote,
      uuid: 'note-843',
      content: 'Was n.843',
      label: 'n.844',
      sort: 844,
    };

    const endnoteRow = (
      uuid: string,
      label: string,
      sort: number,
    ): PassageRowDTO => ({
      uuid,
      work_uuid: 'work-1',
      content: label,
      label,
      sort,
      type: 'endnotes',
    });

    it('renumbers notes past the window and reports their new labels', async () => {
      const state = createState({
        passages: [
          // Already upserted with the label the client computed.
          endnoteRow('note-843', 'n.844', 844),
          // Never loaded by the editor, so still holding pre-insert labels.
          endnoteRow('note-844', 'n.844', 845),
          endnoteRow('note-845', 'n.845', 846),
        ],
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [insertedNote, clientRenumbered],
      });

      expect(result.success).toBe(true);
      expect(state.labelUpserts.flat()).toEqual([
        { uuid: 'note-844', label: 'n.845' },
        { uuid: 'note-845', label: 'n.846' },
      ]);
      expect(result.renumberedPassages).toEqual([
        { uuid: 'note-844', label: 'n.845' },
        { uuid: 'note-845', label: 'n.846' },
      ]);
    });

    it('still stops at a note that was already contiguous on its own', async () => {
      const state = createState({
        passages: [
          // Not in the payload: its label is authoritative evidence that the
          // tail of the series needs no renumbering.
          endnoteRow('note-untouched', 'n.844', 844),
          endnoteRow('note-845', 'n.845', 845),
        ],
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [insertedNote],
      });

      expect(result.success).toBe(true);
      expect(state.labelUpserts).toEqual([]);
      expect(result.renumberedPassages).toEqual([]);
    });

    // A work spanning several Tohoku texts holds per-text variants of one note:
    // same label, distinguished by a non-null `toh`. Advancing the number once
    // per row fans a single slot out across several numbers and cascades
    // through the rest of the sequence.
    it('moves every per-text variant of a slot to the same new number', async () => {
      const state = createState({
        passages: [
          { ...endnoteRow('n4-916', 'n.4', 844), toh: 'toh916' },
          { ...endnoteRow('n4-526', 'n.4', 845), toh: 'toh526' },
          { ...endnoteRow('n4-141', 'n.4', 846), toh: 'toh141' },
          endnoteRow('n5', 'n.5', 847),
        ],
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [{ ...insertedNote, label: 'n.4' }],
      });

      expect(result.success).toBe(true);
      expect(state.labelUpserts.flat()).toEqual([
        { uuid: 'n4-916', label: 'n.5' },
        { uuid: 'n4-526', label: 'n.5' },
        { uuid: 'n4-141', label: 'n.5' },
        { uuid: 'n5', label: 'n.6' },
      ]);
    });

    // Per-text variants of one label routinely share a sort, so the label
    // index must page by a total order or it drops one that falls on a page
    // boundary.
    it('does not skip passages sharing the sort of the last paged row', async () => {
      const pageSize = 500;
      const passages: PassageRowDTO[] = [];

      // Notes each holding the label of the note before it, so every one of
      // them needs renumbering and the walk cannot exit early.
      for (let i = 0; i < pageSize; i++) {
        passages.push(endnoteRow(`bulk-${i}`, `n.${843 + i}`, 844 + i));
      }
      const lastPagedSort = 844 + pageSize - 1;
      const lastPagedLabel = `n.${843 + pageSize - 1}`;
      // The last of them and a per-text variant of it share a sort, across the
      // boundary of the second page.
      passages[pageSize - 1] = {
        ...passages[pageSize - 1],
        toh: 'toh526',
      };
      passages.push({
        ...endnoteRow('variant-sharing-sort', lastPagedLabel, lastPagedSort),
        toh: 'toh916',
      });

      const state = createState({ passages });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [insertedNote],
      });

      expect(result.success).toBe(true);
      const renumbered = new Map(
        result.renumberedPassages.map((row) => [row.uuid, row.label]),
      );

      // It took more than one page to get there...
      expect(
        state.ops.filter((op) => op === 'select:passages:labels').length,
      ).toBeGreaterThan(1);
      // ...and the variant landed on the same number as the sibling it shares a
      // slot with, rather than being read past and left stale.
      const siblingLabel = renumbered.get(`bulk-${pageSize - 1}`);
      expect(siblingLabel).toBe(`n.${844 + pageSize - 1}`);
      expect(renumbered.get('variant-sharing-sort')).toBe(siblingLabel);
    });

    it('renames each child label once when an insert renumbers its parent', async () => {
      const state = createState({
        passages: [
          endnoteRow('a', 'n.843', 844),
          endnoteRow('a1', 'n.843.1', 845),
          endnoteRow('b', 'n.844', 846),
          endnoteRow('b1', 'n.844.1', 847),
        ],
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [insertedNote],
      });

      expect(result.success).toBe(true);
      const labels = Object.fromEntries(
        state.passages.map((row) => [row.uuid, row.label]),
      );
      expect(labels).toMatchObject({
        'note-new': 'n.843',
        a: 'n.844',
        a1: 'n.844.1',
        b: 'n.845',
        b1: 'n.845.1',
      });
      expect(state.ops).not.toContain('rpc:rename_passage_label_prefix');
    });

    it("writes a payload passage's new label with its content", async () => {
      const state = createState({
        passages: [endnoteRow('note-843', 'n.843', 844)],
      });

      await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [insertedNote, { ...clientRenumbered, label: 'n.843' }],
      });

      expect(
        state.passageUpserts.flat().find((row) => row.uuid === 'note-843'),
      ).toMatchObject({ label: 'n.844' });
      expect(state.labelUpserts).toEqual([]);
    });

    it('omits passages returned in `passages` from `renumberedPassages`', async () => {
      const state = createState({
        passages: [
          endnoteRow('note-843', 'n.844', 844),
          endnoteRow('note-844', 'n.844', 845),
        ],
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        // note-844 is both in the payload and renumbered by the walk; it comes
        // back in `passages` with its final label, so reporting it twice would
        // be redundant.
        passages: [
          insertedNote,
          clientRenumbered,
          { ...clientRenumbered, uuid: 'note-844', label: 'n.845', sort: 845 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.renumberedPassages).toEqual([]);
      expect(result.passages.map((row) => row.uuid)).toContain('note-844');
    });
  });
});

describe('savePassagesWithDeletions hardening', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const writes = (state: FakeState) =>
    state.ops.filter(
      (op) =>
        op.startsWith('upsert:') ||
        op.startsWith('delete:') ||
        op.startsWith('rpc:'),
    );

  describe('failed reads write nothing', () => {
    it.each([
      ['select:passages'],
      ['select:annotations'],
      ['select:passages:deleted'],
    ])('%s', async (op) => {
      const state = createState({
        annotations: [annotationRow],
        passages: [passageRow, { ...passageRow, uuid: 'gone', sort: 2 }],
        failOn: { [op]: 'read failed' },
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [
          { ...passage, content: 'Body text!' },
          { ...passage, uuid: 'new', annotations: [] },
        ],
        deletedUuids: ['gone'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('nothing was saved');
      expect(writes(state)).toEqual([]);
    });
  });

  it('deletes an omitted annotation stored past the first 1000 rows', async () => {
    const stored = Array.from({ length: 1200 }, (_, i) => ({
      ...annotationRow,
      uuid: `annotation-${String(i).padStart(4, '0')}`,
    }));
    const state = createState({ annotations: stored, passages: [passageRow] });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        {
          ...passage,
          annotations: stored.slice(0, 1199).map((row) => ({
            uuid: row.uuid,
            passageUuid: 'passage-1',
            start: 0,
            end: 9,
            type: 'paragraph' as const,
          })),
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(state.deletedAnnotationUuids).toEqual(['annotation-1199']);
  });

  it('keeps every `in` list within one batch', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => ({
      ...passageRow,
      uuid: `p-${i}`,
      sort: i,
    }));
    const state = createState({ passages: rows });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: rows.slice(0, 300).map((row) => ({
        ...passage,
        uuid: row.uuid,
        sort: row.sort,
        content: 'changed',
        annotations: [],
      })),
      deletedUuids: rows.slice(300).map((row) => row.uuid),
    });

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(150);
    expect(result.passages).toHaveLength(300);
    expect(state.maxInLength).toBeLessThanOrEqual(200);
  });

  describe('rejects an invalid payload before any read', () => {
    const annotation = passage.annotations[0];
    it.each<[string, Parameters<typeof savePassagesWithDeletions>[0]]>([
      [
        'a passage sent twice',
        { client: null as never, passages: [passage, passage] },
      ],
      [
        'a passage both saved and deleted',
        {
          client: null as never,
          passages: [passage],
          deletedUuids: ['passage-1'],
        },
      ],
      [
        'an annotation sent twice',
        {
          client: null as never,
          passages: [{ ...passage, annotations: [annotation, annotation] }],
        },
      ],
      [
        'an annotation naming another passage',
        {
          client: null as never,
          passages: [
            {
              ...passage,
              annotations: [{ ...annotation, passageUuid: 'passage-2' }],
            },
          ],
        },
      ],
      [
        'a row on a passage outside the save',
        {
          client: null as never,
          passages: [passage],
          annotationRows: [
            { ...annotationRow, uuid: 'row-1', passage_uuid: 'passage-2' },
          ],
        },
      ],
      [
        'a row repeating a nested annotation',
        {
          client: null as never,
          passages: [passage],
          annotationRows: [annotationRow],
        },
      ],
    ])('%s', async (_, args) => {
      const state = createState({ passages: [passageRow] });
      const result = await savePassagesWithDeletions({
        ...args,
        client: createFakeClient(state),
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Invalid save, nothing was saved/);
      expect(state.ops).toEqual([]);
    });
  });

  it('fills in an annotation passage the caller left out', async () => {
    const state = createState({ passages: [passageRow] });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        {
          ...passage,
          annotations: [{ ...passage.annotations[0], passageUuid: '' }],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(state.annotationUpserts.flat()[0].passage_uuid).toBe('passage-1');
  });

  it('reports a failed read-back as a warning, not a failure', async () => {
    const state = createState({
      passages: [passageRow],
      failOn: { 'select:passages:saved': 'read failed' },
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [{ ...passage, content: 'Body text!' }],
    });

    expect(result.success).toBe(true);
    expect(result.passages).toEqual([]);
    expect(result.warnings?.[0]).toContain('read failed');
  });

  // The deleted note was read before the shifts; renumbering from its old
  // sort would relabel the note before it.
  it('renumbers after a deleted note from where the shifts moved it', async () => {
    const note = (n: number): PassageRowDTO => ({
      uuid: `n${n}`,
      work_uuid: 'work-1',
      content: `note ${n}`,
      label: `n.${n}`,
      sort: 9 + n,
      type: 'endnotes',
    });
    const created = (uuid: string): Passage => ({
      uuid,
      workUuid: 'work-1',
      content: uuid,
      label: '',
      sort: 11,
      type: 'translation',
      annotations: [],
    });
    const state = createState({ passages: [1, 2, 3, 4, 5, 6].map(note) });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [created('x'), created('y')],
      deletedUuids: ['n4'],
      anchors: { x: { after: 'n1' }, y: { after: 'n1' } },
    });

    expect(result.success).toBe(true);
    const labels = new Map(state.passages.map((row) => [row.uuid, row.label]));
    expect(
      ['n1', 'n2', 'n3', 'n5', 'n6'].map((uuid) => labels.get(uuid)),
    ).toEqual(['n.1', 'n.2', 'n.3', 'n.4', 'n.5']);
  });

  // Inserting a labelled note relabels the one about to be deleted, too.
  it('renumbers after a deleted note from the label an insert gave it', async () => {
    const note = (n: number): PassageRowDTO => ({
      uuid: `n${n}`,
      work_uuid: 'work-1',
      content: `note ${n}`,
      label: `n.${n}`,
      sort: 9 + n,
      type: 'endnotes',
    });
    const state = createState({ passages: [1, 2, 3, 4, 5, 6].map(note) });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        {
          uuid: 'x',
          workUuid: 'work-1',
          content: 'x',
          label: 'n.2',
          sort: 11,
          type: 'endnotes',
          annotations: [],
        },
      ],
      deletedUuids: ['n4'],
      anchors: { x: { after: 'n1' } },
    });

    expect(result.success).toBe(true);
    const labels = new Map(state.passages.map((row) => [row.uuid, row.label]));
    expect(
      ['n1', 'x', 'n2', 'n3', 'n5', 'n6'].map((uuid) => labels.get(uuid)),
    ).toEqual(['n.1', 'n.2', 'n.3', 'n.4', 'n.5', 'n.6']);
  });

  it('never deletes a stored row of a type editors do not load', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [
        annotationRow,
        { ...annotationRow, uuid: 'legacy', type: 'deprecated-internal-link' },
      ],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(true);
    expect(state.deletedAnnotationUuids).toEqual([]);
  });

  describe('offsets', () => {
    it('rejects a written annotation past the end of its passage', async () => {
      const state = createState({ passages: [passageRow] });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [
          {
            ...passage,
            annotations: [{ ...passage.annotations[0], end: 10 }],
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('annotation-1');
      expect(writes(state)).toEqual([]);
    });

    it('measures content in UTF-16 units', async () => {
      // One astral character is two UTF-16 units.
      const content = 'a\u{1F600}b';
      const state = createState({
        passages: [{ ...passageRow, content: 'old' }],
      });
      const save = (end: number) =>
        savePassagesWithDeletions({
          client: createFakeClient(state),
          passages: [
            {
              ...passage,
              content,
              annotations: [{ ...passage.annotations[0], end }],
            },
          ],
        });

      expect((await save(4)).success).toBe(true);
      expect((await save(5)).success).toBe(false);
    });

    it('rejects a reversed range', async () => {
      const state = createState({ passages: [passageRow] });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [
          {
            ...passage,
            annotations: [{ ...passage.annotations[0], start: 5, end: 2 }],
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('does not check a stored row the save leaves alone', async () => {
      const state = createState({
        passages: [passageRow],
        annotations: [
          annotationRow,
          { ...annotationRow, uuid: 'overrun', start: 0, end: 40 },
        ],
      });

      const result = await savePassagesWithDeletions({
        client: createFakeClient(state),
        passages: [
          {
            ...passage,
            content: 'Body text!',
            annotationsIncomplete: true,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(state.deletedAnnotationUuids).toEqual([]);
    });
  });

  it('fails when a delete is silently filtered', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [annotationRow, { ...annotationRow, uuid: 'annotation-2' }],
      protectedUuids: ['annotation-2'],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not permitted');
  });

  it('accepts a delete of a row another save already removed', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [annotationRow, { ...annotationRow, uuid: 'annotation-2' }],
    });
    state.vanishOnDelete.add('annotation-2');

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
    });

    expect(result.success).toBe(true);
  });

  it('fails a passage delete whose annotations were not all removed', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [annotationRow],
      protectedUuids: ['annotation-1'],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['passage-1'],
    });

    expect(result.success).toBe(false);
    expect(state.passages.map((row) => row.uuid)).toEqual(['passage-1']);
  });

  it('rejects an unchanged annotation that shortened content no longer fits', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [annotationRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [{ ...passage, content: 'Body' }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('annotation-1');
    expect(state.passageUpserts).toEqual([]);
  });

  it('fails when a passage delete is silently filtered', async () => {
    const state = createState({
      passages: [passageRow],
      protectedUuids: ['passage-1'],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['passage-1'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to delete passages');
  });

  it('keeps the stored columns a row in a mixed batch leaves out', async () => {
    const state = createState({
      passages: [
        { ...passageRow, xmlId: 'x-1', toh: 'toh1' as never },
        { ...passageRow, uuid: 'passage-2', sort: 2 },
      ],
    });

    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        { ...passage, content: 'changed', annotations: [] },
        {
          ...passage,
          uuid: 'passage-2',
          sort: 2,
          content: 'changed',
          xmlId: 'x-2',
          annotations: [],
        },
      ],
    });

    const rows = new Map(
      state.passageUpserts.flat().map((row) => [row.uuid, row]),
    );
    expect(rows.get('passage-1')).toMatchObject({
      xmlId: 'x-1',
      toh: 'toh1',
      parent: null,
    });
    expect(rows.get('passage-2')).toMatchObject({ xmlId: 'x-2', toh: null });
  });

  it('keeps the stored toh of an annotation that leaves it out', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [{ ...annotationRow, toh: 'toh1' }],
    });

    await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        { ...passage, annotations: [{ ...passage.annotations[0], end: 4 }] },
      ],
    });

    expect(state.annotationUpserts.flat()[0]).toMatchObject({
      end: 4,
      toh: 'toh1',
    });
  });

  it('keeps the stored row of an annotation sent but not serializable', async () => {
    const state = createState({
      passages: [passageRow],
      annotations: [
        annotationRow,
        { ...annotationRow, uuid: 'odd', type: 'unknown' },
      ],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [
        {
          ...passage,
          annotations: [
            ...passage.annotations,
            {
              uuid: 'odd',
              passageUuid: 'passage-1',
              start: 0,
              end: 1,
              type: 'no-such-type' as never,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(state.deletedAnnotationUuids).toEqual([]);
  });

  it('deletes a link citing two deleted notes once', async () => {
    const link: AnnotationDTO = {
      uuid: 'ref-1',
      passage_uuid: 'passage-1',
      start: 4,
      end: 4,
      type: 'end-note-link',
      content: [{ uuid: 'note-1' }, { uuid: 'note-2' }],
    };
    const note = (uuid: string, sort: number): PassageRowDTO => ({
      ...passageRow,
      uuid,
      sort,
      label: '',
      type: 'endnotes',
    });
    const state = createState({
      passages: [passageRow, note('note-1', 5), note('note-2', 6)],
      annotations: [link],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['note-1', 'note-2'],
    });

    expect(result.success).toBe(true);
    expect(state.deletedAnnotationUuids).toEqual(['ref-1']);
  });

  it('removes a link the editor dropped while deleting its note', async () => {
    const link: AnnotationDTO = {
      uuid: 'ref-1',
      passage_uuid: 'passage-1',
      start: 4,
      end: 4,
      type: 'end-note-link',
      content: [{ uuid: 'note-1' }],
    };
    const state = createState({
      passages: [
        passageRow,
        { ...passageRow, uuid: 'note-1', sort: 5, label: '', type: 'endnotes' },
      ],
      annotations: [annotationRow, link],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [passage],
      deletedUuids: ['note-1'],
    });

    expect(result.success).toBe(true);
    expect(state.deletedAnnotationUuids).toEqual(['ref-1']);
  });
});
