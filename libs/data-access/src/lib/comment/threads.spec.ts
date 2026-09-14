import { getCommentThreadsByAnchorUuids } from './threads';
import type { CommentDTO } from '../types';

type FakeState = {
  rows: CommentDTO[];
  orFilters: string[];
  rangeCalls: [number, number][];
  fromCalls: string[];
  error?: { message: string };
};

/**
 * Matches the `or(uuid.in.(…),parent_uuid.in.(…))` the read builds, so a test
 * exercises the same row selection PostgREST would.
 */
const matches = (row: CommentDTO, filter: string): boolean => {
  const [uuidClause, parentClause] = filter.split('),');
  const uuids = uuidClause.slice(uuidClause.indexOf('(') + 1).split(',');
  const parents = parentClause
    .slice(parentClause.indexOf('(') + 1, -1)
    .split(',');
  return (
    uuids.includes(row.uuid) ||
    (!!row.parent_uuid && parents.includes(row.parent_uuid))
  );
};

class FakeQueryBuilder {
  private rangeStart = 0;
  private rangeEnd = 0;
  private filter = '';

  constructor(private readonly state: FakeState) {}

  select() {
    return this;
  }

  or(filter: string) {
    this.state.orFilters.push(filter);
    this.filter = filter;
    return this;
  }

  order() {
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
          data: CommentDTO[] | null;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const matching = this.state.rows.filter((row) => matches(row, this.filter));
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
      return new FakeQueryBuilder(state);
    },
  }) as never;

const createState = (rows: CommentDTO[] = []): FakeState => ({
  rows,
  orFilters: [],
  rangeCalls: [],
  fromCalls: [],
});

let clock = 0;

const commentRow = (
  uuid: string,
  overrides: Partial<CommentDTO> = {},
): CommentDTO => ({
  uuid,
  parent_uuid: null,
  entity_uuid: 'p-1',
  entity_type: 'passage',
  content: uuid,
  user_uuid: 'u-1',
  created_at: new Date(Date.UTC(2026, 8, 10, 0, 0, clock++)).toISOString(),
  updated_at: '2026-09-10T10:00:00+00:00',
  resolved_at: null,
  resolved_by: null,
  ...overrides,
});

beforeEach(() => {
  clock = 0;
});

describe('getCommentThreadsByAnchorUuids', () => {
  it('keys a thread by the uuid its anchor points at', async () => {
    const state = createState([
      commentRow('c-1'),
      commentRow('c-2', { parent_uuid: 'c-1' }),
      commentRow('c-3'),
    ]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1', 'c-3'],
      source: 'draft',
    });

    expect([...result.keys()].sort()).toEqual(['c-1', 'c-3']);
    expect(result.get('c-1')?.replies?.map(({ uuid }) => uuid)).toEqual(['c-2']);
    expect(result.get('c-3')?.replies).toBeUndefined();
  });

  it('finds a thread whose entity_uuid names a different passage', async () => {
    // The point of keying on the anchor: a split moved the anchor to p-2 while
    // provenance still says p-1, and the thread must resolve all the same.
    const state = createState([commentRow('c-1', { entity_uuid: 'p-1' })]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    expect(result.get('c-1')?.uuid).toBe('c-1');
  });

  it('resolves up to the root when an anchor points at a reply', async () => {
    const state = createState([
      commentRow('c-1'),
      commentRow('c-2', { parent_uuid: 'c-1' }),
      commentRow('c-3', { parent_uuid: 'c-1' }),
    ]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-2'],
      source: 'draft',
    });

    const thread = result.get('c-2');
    expect(thread?.uuid).toBe('c-1');
    expect(thread?.replies?.map(({ uuid }) => uuid)).toEqual(['c-2', 'c-3']);
  });

  it('omits an anchor whose comment is gone rather than erroring', async () => {
    const state = createState([commentRow('c-1')]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1', 'c-missing'],
      source: 'draft',
    });

    expect(result.has('c-missing')).toBe(false);
    expect(result.has('c-1')).toBe(true);
  });

  it('carries resolved state on the root of a multi-author thread', async () => {
    const state = createState([
      commentRow('c-1', {
        user_uuid: 'u-1',
        resolved_at: '2026-09-12T10:00:00+00:00',
        resolved_by: 'u-3',
      }),
      commentRow('c-2', { parent_uuid: 'c-1', user_uuid: 'u-2' }),
      commentRow('c-3', { parent_uuid: 'c-1', user_uuid: 'u-3' }),
    ]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    const thread = result.get('c-1');
    expect(thread?.resolvedAt).toBe('2026-09-12T10:00:00+00:00');
    expect(thread?.resolvedBy).toBe('u-3');
    expect(thread?.replies?.map(({ userUuid }) => userUuid)).toEqual([
      'u-2',
      'u-3',
    ]);
    // Resolution is the thread's, so no reply carries its own.
    expect(thread?.replies?.every((reply) => !reply.resolvedAt)).toBe(true);
  });

  it('orders replies oldest first regardless of the order they are read in', async () => {
    const root = commentRow('c-1');
    const earlier = commentRow('c-2', { parent_uuid: 'c-1' });
    const later = commentRow('c-3', { parent_uuid: 'c-1' });
    const state = createState([root, later, earlier]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    expect(result.get('c-1')?.replies?.map(({ uuid }) => uuid)).toEqual([
      'c-2',
      'c-3',
    ]);
  });

  it('returns empty for a published read without querying', async () => {
    const state = createState([commentRow('c-1')]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'published',
    });

    expect(result.size).toBe(0);
    expect(state.fromCalls).toEqual([]);
  });

  it('defaults to published, so a caller that does not ask reads no comments', async () => {
    const state = createState([commentRow('c-1')]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
    });

    expect(result.size).toBe(0);
    expect(state.fromCalls).toEqual([]);
  });

  it('does not query for an empty anchor list', async () => {
    const state = createState();

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: [],
      source: 'draft',
    });

    expect(result.size).toBe(0);
    expect(state.fromCalls).toEqual([]);
  });

  it('issues one query for many anchors, whatever their thread sizes', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => commentRow(`c-${i}`));
    for (let i = 0; i < 20; i++) {
      for (let r = 0; r < 5; r++) {
        rows.push(commentRow(`r-${i}-${r}`, { parent_uuid: `c-${i}` }));
      }
    }
    const state = createState(rows);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: rows.slice(0, 20).map(({ uuid }) => uuid),
      source: 'draft',
    });

    expect(state.fromCalls).toHaveLength(1);
    expect(result.size).toBe(20);
    expect(result.get('c-0')?.replies).toHaveLength(5);
  });

  it('batches the uuid list at 100, since each uuid appears twice in the URL', async () => {
    const state = createState();
    const anchorUuids = Array.from({ length: 250 }, (_, i) => `c-${i}`);

    await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids,
      source: 'draft',
    });

    expect(state.orFilters).toHaveLength(3);
    const first = state.orFilters[0];
    expect(first.startsWith('uuid.in.(')).toBe(true);
    expect(first.includes('parent_uuid.in.(')).toBe(true);
  });

  it('pages until a short page, since PostgREST truncates at 1000 silently', async () => {
    const rows = [
      commentRow('c-1'),
      ...Array.from({ length: 1200 }, (_, i) =>
        commentRow(`r-${i}`, { parent_uuid: 'c-1' }),
      ),
    ];
    const state = createState(rows);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    expect(state.rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(result.get('c-1')?.replies).toHaveLength(1200);
  });

  it('returns empty on error rather than a partial map', async () => {
    const state = createState([commentRow('c-1')]);
    state.error = { message: 'boom' };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    expect(result.size).toBe(0);
    consoleError.mockRestore();
  });
});
