import { getCommentsByEntityUuids } from './batch';
import type { CommentDTO } from '../types';

type FakeRow = Record<string, unknown>;

type FakeState = {
  rows: FakeRow[];
  orderColumns: string[];
  rangeCalls: [number, number][];
  inValues: string[][];
  eqFilters: [string, unknown][];
  fromCalls: string[];
  error?: { message: string };
};

class FakeBatchQueryBuilder {
  private rangeStart = 0;
  private rangeEnd = 0;
  private batch: string[] = [];

  constructor(private readonly state: FakeState) {}

  select() {
    return this;
  }

  in(_column: string, values: string[]) {
    this.state.inValues.push(values);
    this.batch = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.eqFilters.push([column, value]);
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
    const matching = this.state.rows.filter((row) =>
      this.batch.includes(row.entity_uuid as string),
    );
    const result = this.state.error
      ? { data: null, error: this.state.error }
      : {
          data: matching.slice(this.rangeStart, this.rangeEnd + 1),
          error: null,
        };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

const createFakeClient = (state: FakeState) =>
  ({
    from: (relation: string) => {
      state.fromCalls.push(relation);
      return new FakeBatchQueryBuilder(state);
    },
  }) as never;

const createState = (rows: FakeRow[] = []): FakeState => ({
  rows,
  orderColumns: [],
  rangeCalls: [],
  inValues: [],
  eqFilters: [],
  fromCalls: [],
});

const commentRow = (
  uuid: string,
  entityUuid: string,
  overrides: Partial<CommentDTO> = {},
): CommentDTO => ({
  uuid,
  parent_uuid: null,
  entity_uuid: entityUuid,
  entity_type: 'passage',
  content: uuid,
  user_uuid: 'u-1',
  created_at: `2026-09-10T10:00:0${uuid.slice(-1)}+00:00`,
  updated_at: '2026-09-10T10:00:00+00:00',
  resolved_at: null,
  resolved_by: null,
  ...overrides,
});

describe('getCommentsByEntityUuids', () => {
  it('keys thread roots by entity uuid', async () => {
    const state = createState([
      commentRow('c-1', 'p-1'),
      commentRow('c-2', 'p-1', { parent_uuid: 'c-1' }),
      commentRow('c-3', 'p-2'),
    ]);

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1', 'p-2'],
      entityType: 'passage',
      source: 'draft',
    });

    expect([...result.keys()].sort()).toEqual(['p-1', 'p-2']);
    expect(result.get('p-1')?.map(({ uuid }) => uuid)).toEqual(['c-1']);
    expect(result.get('p-1')?.[0].replies?.map(({ uuid }) => uuid)).toEqual([
      'c-2',
    ]);
    expect(result.get('p-2')?.map(({ uuid }) => uuid)).toEqual(['c-3']);
  });

  it('omits an entity with no comments rather than mapping it to empty', async () => {
    const state = createState([commentRow('c-1', 'p-1')]);

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1', 'p-2'],
      entityType: 'passage',
      source: 'draft',
    });

    expect(result.has('p-2')).toBe(false);
  });

  it('returns empty for a published read without querying', async () => {
    const state = createState([commentRow('c-1', 'p-1')]);

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1'],
      entityType: 'passage',
      source: 'published',
    });

    expect(result.size).toBe(0);
    expect(state.fromCalls).toEqual([]);
  });

  it('defaults to published, so a caller that does not ask reads no comments', async () => {
    const state = createState([commentRow('c-1', 'p-1')]);

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1'],
      entityType: 'passage',
    });

    expect(result.size).toBe(0);
    expect(state.fromCalls).toEqual([]);
  });

  it('does not query for an empty entity list', async () => {
    const state = createState();

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: [],
      entityType: 'passage',
      source: 'draft',
    });

    expect(result.size).toBe(0);
    expect(state.fromCalls).toEqual([]);
  });

  it('filters on the entity type', async () => {
    const state = createState([commentRow('c-1', 'p-1')]);

    await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1'],
      entityType: 'passage',
      source: 'draft',
    });

    expect(state.eqFilters).toEqual([['entity_type', 'passage']]);
  });

  it('orders by entity, created_at, then uuid for stable paging', async () => {
    const state = createState([commentRow('c-1', 'p-1')]);

    await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1'],
      entityType: 'passage',
      source: 'draft',
    });

    expect(state.orderColumns).toEqual(['entity_uuid', 'created_at', 'uuid']);
  });

  it('batches the uuid list at 200 to stay under the URL limit', async () => {
    const state = createState();
    const entityUuids = Array.from({ length: 450 }, (_, i) => `p-${i}`);

    await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids,
      entityType: 'passage',
      source: 'draft',
    });

    expect(state.inValues.map((batch) => batch.length)).toEqual([200, 200, 50]);
  });

  it('pages until a short page, since PostgREST truncates at 1000 silently', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) =>
      commentRow(`c-${i}`, 'p-1'),
    );

    const state = createState(rows);

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1'],
      entityType: 'passage',
      source: 'draft',
    });

    expect(state.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(result.get('p-1')).toHaveLength(1200);
  });

  it('returns empty on error rather than a partial map', async () => {
    const state = createState([commentRow('c-1', 'p-1')]);
    state.error = { message: 'boom' };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await getCommentsByEntityUuids({
      client: createFakeClient(state),
      entityUuids: ['p-1'],
      entityType: 'passage',
      source: 'draft',
    });

    expect(result.size).toBe(0);
    consoleError.mockRestore();
  });
});
