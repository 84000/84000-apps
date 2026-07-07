import { savePassagesWithDeletions } from './save';
import type { AnnotationDTO, Passage, PassageRowDTO } from '../types';

type TableName = 'passages' | 'passage_annotations';

/**
 * Operation names recorded in `state.ops` and accepted by `state.failOn`:
 * - rpc:shift_passage_sorts / rpc:rename_passage_label_prefix
 * - select:passages / select:passages:renumber / select:annotations /
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
};

const failResult = (state: FakeState, op: string) => {
  const message = state.failOn?.[op];
  return message ? { message } : null;
};

class FakeQueryBuilder {
  private action?: 'select' | 'delete';
  private inColumn?: string;
  private inValues: string[] = [];
  private eqType?: string;
  private eqWorkUuid?: string;
  private gtSort?: number;
  private filterContentUuid?: string;

  constructor(
    private readonly state: FakeState,
    private readonly table: TableName,
  ) {}

  select() {
    this.action = 'select';
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(rows: PassageRowDTO[] | AnnotationDTO[]) {
    if (this.table === 'passages') {
      const isLabelOnly = (rows as { uuid: string }[]).every(
        (row) =>
          Object.keys(row)
            .sort()
            .join(',') === 'label,uuid',
      );
      const op = isLabelOnly ? 'upsert:passages:labels' : 'upsert:passages';
      this.state.ops.push(op);
      const error = failResult(this.state, op);
      if (error) {
        return Promise.resolve({ error });
      }
      if (isLabelOnly) {
        this.state.labelUpserts.push(
          rows as { uuid: string; label: string }[],
        );
      } else {
        this.state.passageUpserts.push(rows as PassageRowDTO[]);
      }
    } else {
      this.state.ops.push('upsert:annotations');
      const error = failResult(this.state, 'upsert:annotations');
      if (error) {
        return Promise.resolve({ error });
      }
      this.state.annotationUpserts.push(rows as AnnotationDTO[]);
    }
    return Promise.resolve({ error: null });
  }

  in(column: string, values: string[]) {
    this.inColumn = column;
    this.inValues = values;
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

  gt(column: string, value: number) {
    if (column === 'sort') {
      this.gtSort = value;
    }
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
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
      return this.gtSort !== undefined
        ? 'select:passages:renumber'
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
      if (this.table === 'passage_annotations') {
        if (this.inColumn === 'passage_uuid') {
          this.state.deletedAnnotationUuids.push(
            ...this.state.annotations
              .filter((annotation) =>
                this.inValues.includes(annotation.passage_uuid ?? ''),
              )
              .map((annotation) => annotation.uuid),
          );
        } else {
          this.state.deletedAnnotationUuids.push(...this.inValues);
        }
      } else {
        this.state.deletedPassageUuids.push(...this.inValues);
      }
      return { data: [], error: null };
    }

    if (this.table === 'passage_annotations') {
      if (this.filterContentUuid) {
        return {
          data: this.state.annotations.filter(
            (annotation) =>
              (!this.eqType || annotation.type === this.eqType) &&
              Array.isArray(annotation.content) &&
              annotation.content.some(
                (entry) =>
                  (entry as { uuid?: string })?.uuid === this.filterContentUuid,
              ),
          ),
          error: null,
        };
      }
      return {
        data: this.state.annotations.filter((annotation) =>
          this.inValues.includes(annotation.passage_uuid ?? ''),
        ),
        error: null,
      };
    }

    if (this.eqWorkUuid !== undefined && this.gtSort !== undefined) {
      const gtSort = this.gtSort;
      return {
        data: this.state.passages
          .filter(
            (passage) =>
              passage.work_uuid === this.eqWorkUuid && passage.sort > gtSort,
          )
          .sort((a, b) => a.sort - b.sort),
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
    rpc: (name: string) => {
      const op = `rpc:${name}`;
      state.ops.push(op);
      const error = failResult(state, op);
      return Promise.resolve({ error });
    },
  }) as never;

const createState = ({
  annotations = [],
  passages = [],
  failOn,
}: {
  annotations?: AnnotationDTO[];
  passages?: PassageRowDTO[];
  failOn?: Partial<Record<string, string>>;
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
    expect(state.annotationUpserts).toEqual([[annotationRow]]);
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

  it('renumbers labels only after the passage delete succeeds', async () => {
    const state = createState({
      annotations: [],
      passages: [passageRow],
    });

    const result = await savePassagesWithDeletions({
      client: createFakeClient(state),
      passages: [],
      deletedUuids: ['passage-1'],
    });

    expect(result.success).toBe(true);
    const deleteIndex = state.ops.indexOf('delete:passages');
    const renumberIndex = state.ops.indexOf('select:passages:renumber');
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(renumberIndex).toBeGreaterThan(deleteIndex);
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
});
