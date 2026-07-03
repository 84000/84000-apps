import {
  getAlignmentsByPassageUuids,
  getAnnotationsByPassageUuids,
} from './batch';
import type { AlignmentDTO, AnnotationDTO } from '../types';

type FakeRow = Record<string, unknown>;

type FakeState = {
  rows: FakeRow[];
  orderColumns: string[];
  rangeCalls: [number, number][];
  error?: { message: string };
};

class FakeBatchQueryBuilder {
  private rangeStart = 0;
  private rangeEnd = 0;

  constructor(private readonly state: FakeState) {}

  select() {
    return this;
  }

  in() {
    return this;
  }

  not() {
    return this;
  }

  order(column: string) {
    this.state.orderColumns.push(column);
    return this;
  }

  range(from: number, to: number) {
    this.rangeStart = from;
    this.rangeEnd = to;
    this.state.rangeCalls.push([from, to]);
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: FakeRow[] | null;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const result = this.state.error
      ? { data: null, error: this.state.error }
      : {
          data: this.state.rows.slice(this.rangeStart, this.rangeEnd + 1),
          error: null,
        };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

const createFakeClient = (state: FakeState) =>
  ({
    from: () => new FakeBatchQueryBuilder(state),
  }) as never;

const createState = (rows: FakeRow[]): FakeState => ({
  rows,
  orderColumns: [],
  rangeCalls: [],
});

const annotationRow = (
  uuid: string,
  passageUuid: string,
  start = 0,
  end = 0,
): AnnotationDTO => ({
  uuid,
  passage_uuid: passageUuid,
  type: 'span',
  start,
  end,
  content: [],
});

describe('getAnnotationsByPassageUuids', () => {
  it('orders by passage_uuid then uuid for stable pagination', async () => {
    const state = createState([annotationRow('a-1', 'p-1')]);

    await getAnnotationsByPassageUuids({
      client: createFakeClient(state),
      passageUuids: ['p-1'],
    });

    expect(state.orderColumns).toEqual(['passage_uuid', 'uuid']);
  });

  it('concatenates pages until a short page is returned', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) =>
      annotationRow(`a-${i}`, 'p-1'),
    );
    const state = createState(rows);

    const result = await getAnnotationsByPassageUuids({
      client: createFakeClient(state),
      passageUuids: ['p-1'],
    });

    expect(state.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(result.get('p-1')).toHaveLength(1500);
  });

  it('groups by passage and sorts by start ascending, end descending', async () => {
    const state = createState([
      annotationRow('a-1', 'p-1', 5, 10),
      annotationRow('a-2', 'p-2', 0, 3),
      annotationRow('a-3', 'p-1', 0, 4),
      annotationRow('a-4', 'p-1', 0, 8),
    ]);

    const result = await getAnnotationsByPassageUuids({
      client: createFakeClient(state),
      passageUuids: ['p-1', 'p-2'],
    });

    expect(result.get('p-1')?.map((a) => a.uuid)).toEqual([
      'a-4',
      'a-3',
      'a-1',
    ]);
    expect(result.get('p-2')?.map((a) => a.uuid)).toEqual(['a-2']);
  });

  it('returns an empty map on query error', async () => {
    const state = createState([annotationRow('a-1', 'p-1')]);
    state.error = { message: 'boom' };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await getAnnotationsByPassageUuids({
      client: createFakeClient(state),
      passageUuids: ['p-1'],
    });

    expect(result.size).toBe(0);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('getAlignmentsByPassageUuids', () => {
  const alignmentRow = (
    passageUuid: string,
    folioUuid: string,
  ): AlignmentDTO & { passage_uuid: string } => ({
    passage_uuid: passageUuid,
    folio_uuid: folioUuid,
    toh: 'toh1',
    tibetan: 'བོད།',
    folio_number: 1,
    volume_number: 1,
  });

  it('orders by passage_uuid, folio_uuid, toh for stable pagination', async () => {
    const state = createState([alignmentRow('p-1', 'f-1')]);

    await getAlignmentsByPassageUuids({
      client: createFakeClient(state),
      passageUuids: ['p-1'],
    });

    expect(state.orderColumns).toEqual(['passage_uuid', 'folio_uuid', 'toh']);
  });

  it('concatenates pages and groups by passage', async () => {
    const rows = [
      ...Array.from({ length: 1000 }, (_, i) => alignmentRow('p-1', `f-${i}`)),
      alignmentRow('p-2', 'f-x'),
    ];
    const state = createState(rows);

    const result = await getAlignmentsByPassageUuids({
      client: createFakeClient(state),
      passageUuids: ['p-1', 'p-2'],
    });

    expect(state.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(result.get('p-1')).toHaveLength(1000);
    expect(result.get('p-2')).toHaveLength(1);
  });
});
