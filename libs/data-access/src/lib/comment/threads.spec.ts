import {
  getCommentThreadByUuid,
  getCommentThreadsByAnchorUuids,
} from './threads';
import type { CommentDTO } from '../types';

type FakeState = {
  rows: CommentDTO[];
  /** One entry per read: the column filtered on and the values passed. */
  reads: [string, string[]][];
  rangeCalls: [number, number][];
  error?: { message: string };
};

class FakeQueryBuilder {
  private rangeStart = 0;
  private rangeEnd = 0;
  private column = '';
  private values: string[] = [];

  constructor(private readonly state: FakeState) {}

  select() {
    return this;
  }

  in(column: string, values: string[]) {
    this.column = column;
    this.values = values;
    this.state.reads.push([column, values]);
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
    const matching = this.state.rows.filter((row) =>
      this.values.includes(
        String(row[this.column as 'uuid' | 'entity_uuid'] ?? ''),
      ),
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
  ({ from: () => new FakeQueryBuilder(state) }) as never;

const createState = (rows: CommentDTO[] = []): FakeState => ({
  rows,
  reads: [],
  rangeCalls: [],
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

/** root c-0, then c-1 replying to it, c-2 replying to that, and so on. */
const chain = (depth: number, entityUuid = 'p-1'): CommentDTO[] =>
  Array.from({ length: depth + 1 }, (_, i) =>
    commentRow(`c-${i}`, {
      entity_uuid: entityUuid,
      parent_uuid: i === 0 ? null : `c-${i - 1}`,
    }),
  );

const readColumns = (state: FakeState) => state.reads.map(([column]) => column);

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

  it('finds a thread anchored on a passage its entity_uuid does not name', async () => {
    // The point of keying on the anchor: a split moved the anchor to another
    // passage while provenance still names the one the thread was born on.
    const state = createState([commentRow('c-1', { entity_uuid: 'p-1' })]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    expect(result.get('c-1')?.uuid).toBe('c-1');
  });

  it('resolves an anchor naming a reply to its thread root', async () => {
    const state = createState(chain(1));

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'draft',
    });

    expect(result.get('c-1')?.uuid).toBe('c-0');
  });

  it('resolves an anchor naming a deeply nested reply, at any depth', async () => {
    const state = createState(chain(8));

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-8'],
      source: 'draft',
      maxDepth: 2,
    });

    // Depth bounds the response, never which thread an anchor belongs to.
    expect(result.get('c-8')?.uuid).toBe('c-0');
  });

  it('nests to maxDepth and reports the true replyCount beyond it', async () => {
    const state = createState(chain(5));

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-0'],
      source: 'draft',
      maxDepth: 2,
    });

    const root = result.get('c-0');
    const level1 = root?.replies?.[0];
    const level2 = level1?.replies?.[0];

    expect(root?.uuid).toBe('c-0');
    expect(level1?.uuid).toBe('c-1');
    expect(level2?.uuid).toBe('c-2');
    // Truncated here, but it says there is more below.
    expect(level2?.replies).toBeUndefined();
    expect(level2?.replyCount).toBe(1);
  });

  it('distinguishes a leaf from a truncated branch by replyCount', async () => {
    const state = createState([
      commentRow('c-0'),
      commentRow('c-1', { parent_uuid: 'c-0' }),
    ]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-0'],
      source: 'draft',
      maxDepth: 2,
    });

    expect(result.get('c-0')?.replies?.[0].replyCount).toBe(0);
  });

  it('terminates on a parent cycle rather than spinning', async () => {
    const state = createState([
      commentRow('a', { parent_uuid: 'b' }),
      commentRow('b', { parent_uuid: 'a' }),
    ]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['a'],
      source: 'draft',
    });

    // No comment in a cycle is a root, so there is no thread to return — but
    // the read comes back rather than hanging.
    expect(result.size).toBe(0);
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

  it('issues two reads regardless of anchor count, thread size or depth', async () => {
    const rows = [
      ...chain(12, 'p-1'),
      ...Array.from({ length: 30 }, (_, i) =>
        commentRow(`r-${i}`, { entity_uuid: 'p-1', parent_uuid: 'c-0' }),
      ),
    ];
    const state = createState(rows);

    await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: rows.map(({ uuid }) => uuid),
      source: 'draft',
    });

    expect(readColumns(state)).toEqual(['uuid', 'entity_uuid']);
  });

  it('resolves anchors whose threads live in different scopes', async () => {
    const state = createState([
      commentRow('a-0', { entity_uuid: 'p-1' }),
      commentRow('b-0', { entity_uuid: 'p-2' }),
      commentRow('b-1', { entity_uuid: 'p-2', parent_uuid: 'b-0' }),
    ]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['a-0', 'b-1'],
      source: 'draft',
    });

    expect(result.get('a-0')?.uuid).toBe('a-0');
    expect(result.get('b-1')?.uuid).toBe('b-0');
  });

  it('returns empty for a published read without querying', async () => {
    const state = createState([commentRow('c-1')]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
      source: 'published',
    });

    expect(result.size).toBe(0);
    expect(state.reads).toEqual([]);
  });

  it('defaults to published, so a caller that does not ask reads no comments', async () => {
    const state = createState([commentRow('c-1')]);

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-1'],
    });

    expect(result.size).toBe(0);
    expect(state.reads).toEqual([]);
  });

  it('does not query for an empty anchor list', async () => {
    const state = createState();

    const result = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: [],
      source: 'draft',
    });

    expect(result.size).toBe(0);
    expect(state.reads).toEqual([]);
  });

  it('batches the uuid list at 200 to stay under the URL limit', async () => {
    const state = createState();
    const anchorUuids = Array.from({ length: 450 }, (_, i) => `c-${i}`);

    await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids,
      source: 'draft',
    });

    expect(state.reads.map(([, values]) => values.length)).toEqual([
      200, 200, 50,
    ]);
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

    expect(state.rangeCalls).toContainEqual([1000, 1999]);
    expect(result.get('c-1')?.replyCount).toBe(1200);
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

describe('getCommentThreadByUuid', () => {
  it('nests from the named comment down, not from the thread root', async () => {
    const state = createState(chain(5));

    const thread = await getCommentThreadByUuid({
      client: createFakeClient(state),
      uuid: 'c-2',
      source: 'draft',
      maxDepth: 2,
    });

    expect(thread?.uuid).toBe('c-2');
    expect(thread?.replies?.[0].uuid).toBe('c-3');
    expect(thread?.replies?.[0].replies?.[0].uuid).toBe('c-4');
  });

  it('continues where a truncated read stopped', async () => {
    const state = createState(chain(4));

    const page = await getCommentThreadsByAnchorUuids({
      client: createFakeClient(state),
      anchorUuids: ['c-0'],
      source: 'draft',
      maxDepth: 2,
    });

    const truncated = page.get('c-0')?.replies?.[0].replies?.[0];
    expect(truncated?.uuid).toBe('c-2');
    expect(truncated?.replies).toBeUndefined();
    expect(truncated?.replyCount).toBe(1);

    const rest = await getCommentThreadByUuid({
      client: createFakeClient(state),
      uuid: truncated?.uuid ?? '',
      source: 'draft',
      maxDepth: 2,
    });

    expect(rest?.replies?.[0].uuid).toBe('c-3');
    expect(rest?.replies?.[0].replies?.[0].uuid).toBe('c-4');
  });

  it('returns null for a published read and for an unknown uuid', async () => {
    const state = createState(chain(1));

    expect(
      await getCommentThreadByUuid({
        client: createFakeClient(state),
        uuid: 'c-0',
        source: 'published',
      }),
    ).toBeNull();

    expect(
      await getCommentThreadByUuid({
        client: createFakeClient(state),
        uuid: 'nope',
        source: 'draft',
      }),
    ).toBeNull();
  });
});
