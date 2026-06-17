import { savePassagesWithDeletions } from './save';
import type { AnnotationDTO, Passage, PassageRowDTO } from '../types';

type TableName = 'passages' | 'passage_annotations';

type FakeState = {
  annotations: AnnotationDTO[];
  deletedAnnotationUuids: string[];
  deletedPassageUuids: string[];
  passageUpserts: PassageRowDTO[][];
  passages: PassageRowDTO[];
  annotationUpserts: AnnotationDTO[][];
};

class FakeQueryBuilder {
  private action?: 'select' | 'delete';
  private inColumn?: string;
  private inValues: string[] = [];
  private eqType?: string;
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
      this.state.passageUpserts.push(rows as PassageRowDTO[]);
    } else {
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

  gt() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown[];
          error?: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
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
    rpc: jest.fn().mockResolvedValue({ error: null }),
  }) as never;

const createState = ({
  annotations = [],
  passages = [],
}: {
  annotations?: AnnotationDTO[];
  passages?: PassageRowDTO[];
}): FakeState => ({
  annotations,
  deletedAnnotationUuids: [],
  deletedPassageUuids: [],
  passageUpserts: [],
  passages,
  annotationUpserts: [],
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
