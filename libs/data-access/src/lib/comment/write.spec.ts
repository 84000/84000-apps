import {
  createComment,
  deleteComment,
  replyToComment,
  resolveComment,
  updateComment,
} from './write';
import type { CommentDTO, DataClient } from '../types';

const AUTHOR = 'user-1';
const OTHER = 'user-2';
const PASSAGE = 'passage-1';

type FakeState = {
  comments: CommentDTO[];
  passages: { uuid: string }[];
  /** One entry per statement, as `<action>:<table>`. */
  ops: string[];
  /** An RLS-filtered UPDATE or DELETE: succeeds, affects nothing, no error. */
  refuseWrites: boolean;
  error?: { message: string };
};

type Row = Record<string, unknown>;

class FakeQueryBuilder {
  private action?: 'select' | 'insert' | 'update' | 'delete';
  private payload: Row = {};
  private eqFilters: [string, string][] = [];
  private inFilter?: [string, string[]];

  constructor(
    private readonly state: FakeState,
    private readonly table: string,
  ) {}

  select() {
    this.action ??= 'select';
    return this;
  }

  insert(row: Row) {
    this.action = 'insert';
    this.payload = row;
    return this;
  }

  update(patch: Row) {
    this.action = 'update';
    this.payload = patch;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: string) {
    this.eqFilters.push([column, value]);
    return this;
  }

  in(column: string, values: string[]) {
    this.inFilter = [column, values];
    return this;
  }

  order() {
    return this;
  }

  range() {
    return this;
  }

  private rows(): Row[] {
    return this.table === 'comments'
      ? (this.state.comments as unknown as Row[])
      : (this.state.passages as unknown as Row[]);
  }

  private matching(): Row[] {
    return this.rows().filter((row) => {
      const eqMatches = this.eqFilters.every(
        ([column, value]) => row[column] === value,
      );
      const inMatches = this.inFilter
        ? this.inFilter[1].includes(String(row[this.inFilter[0]]))
        : true;
      return eqMatches && inMatches;
    });
  }

  private run(): { data: Row[] | null; error: { message: string } | null } {
    this.state.ops.push(`${this.action}:${this.table}`);

    if (this.state.error) return { data: null, error: this.state.error };

    switch (this.action) {
      case 'insert': {
        const inserted = {
          uuid: `comment-${this.state.comments.length + 1}`,
          parent_uuid: null,
          resolved_at: null,
          resolved_by: null,
          created_at: '2026-09-16T00:00:00Z',
          updated_at: '2026-09-16T00:00:00Z',
          ...this.payload,
        } as unknown as CommentDTO;
        this.state.comments.push(inserted);
        return { data: [inserted as unknown as Row], error: null };
      }
      case 'update': {
        if (this.state.refuseWrites) return { data: [], error: null };
        const affected = this.matching();
        for (const row of affected) Object.assign(row, this.payload);
        return { data: affected, error: null };
      }
      case 'delete': {
        if (this.state.refuseWrites) return { data: [], error: null };
        const affected = this.matching();
        const removed = new Set(affected.map((row) => String(row['uuid'])));
        // The `parent_uuid` cascade, which runs in the database rather than
        // through any statement this fake sees.
        let grew = true;
        while (grew) {
          grew = false;
          for (const row of this.state.comments) {
            const parent = row.parent_uuid;
            if (parent && removed.has(parent) && !removed.has(row.uuid)) {
              removed.add(row.uuid);
              grew = true;
            }
          }
        }
        this.state.comments = this.state.comments.filter(
          (row) => !removed.has(row.uuid),
        );
        return { data: affected, error: null };
      }
      default:
        return { data: this.matching(), error: null };
    }
  }

  single() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error });
  }

  maybeSingle() {
    return this.single();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Row[] | null;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

const comment = (overrides: Partial<CommentDTO> = {}): CommentDTO => ({
  uuid: 'root-1',
  entity_uuid: PASSAGE,
  entity_type: 'passage',
  content: 'A note',
  user_uuid: AUTHOR,
  created_at: '2026-09-15T00:00:00Z',
  updated_at: '2026-09-15T00:00:00Z',
  parent_uuid: null,
  resolved_at: null,
  resolved_by: null,
  ...overrides,
});

const fakeClient = (overrides: Partial<FakeState> = {}) => {
  const state: FakeState = {
    comments: [],
    passages: [{ uuid: PASSAGE }],
    ops: [],
    refuseWrites: false,
    ...overrides,
  };

  const client = {
    from: (table: string) => new FakeQueryBuilder(state, table),
  } as unknown as DataClient;

  return { client, state };
};

describe('createComment', () => {
  it('saves the comment under the session user and returns it', async () => {
    const { client, state } = fakeClient();

    const result = await createComment({
      client,
      entityUuid: PASSAGE,
      entityType: 'passage',
      content: '  Needs a source  ',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(true);
    expect(result.comment).toMatchObject({
      entityUuid: PASSAGE,
      entityType: 'passage',
      content: 'Needs a source',
      userUuid: AUTHOR,
      replyCount: 0,
    });
    expect(state.comments).toHaveLength(1);
  });

  it('rejects an entity type this build does not know', async () => {
    const { client, state } = fakeClient();

    const result = await createComment({
      client,
      entityUuid: PASSAGE,
      entityType: 'glossary',
      content: 'A note',
      userUuid: AUTHOR,
    });

    expect(result).toEqual({
      success: false,
      error: 'Unknown comment entity type: glossary',
    });
    expect(state.ops).toEqual([]);
  });

  it('rejects an entity uuid that does not exist', async () => {
    const { client, state } = fakeClient();

    const result = await createComment({
      client,
      entityUuid: 'passage-missing',
      entityType: 'passage',
      content: 'A note',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No passage found for passage-missing');
    expect(state.comments).toEqual([]);
  });

  it('rejects empty content', async () => {
    const { client, state } = fakeClient();

    const result = await createComment({
      client,
      entityUuid: PASSAGE,
      entityType: 'passage',
      content: '   ',
      userUuid: AUTHOR,
    });

    expect(result).toEqual({
      success: false,
      error: 'Comment cannot be empty',
    });
    expect(state.ops).toEqual([]);
  });
});

describe('replyToComment', () => {
  it('inherits the scope of the comment it answers', async () => {
    const { client, state } = fakeClient({
      comments: [comment({ uuid: 'root-1', entity_uuid: 'passage-9' })],
    });

    const result = await replyToComment({
      client,
      parentUuid: 'root-1',
      content: 'Agreed',
      userUuid: OTHER,
    });

    expect(result.success).toBe(true);
    expect(result.comment).toMatchObject({
      parentUuid: 'root-1',
      entityUuid: 'passage-9',
      entityType: 'passage',
      userUuid: OTHER,
    });
    expect(state.comments).toHaveLength(2);
  });

  it('rejects a parent that does not exist', async () => {
    const { client } = fakeClient();

    const result = await replyToComment({
      client,
      parentUuid: 'root-missing',
      content: 'Agreed',
      userUuid: AUTHOR,
    });

    expect(result).toEqual({
      success: false,
      error: 'No comment found for root-missing',
    });
  });

  it('refuses to answer a comment caught in a parent cycle', async () => {
    const { client, state } = fakeClient({
      comments: [
        comment({ uuid: 'a', parent_uuid: 'b' }),
        comment({ uuid: 'b', parent_uuid: 'a' }),
      ],
    });

    const result = await replyToComment({
      client,
      parentUuid: 'a',
      content: 'Agreed',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('broken or cyclic');
    expect(state.comments).toHaveLength(2);
  });
});

describe('updateComment', () => {
  it('lets the author edit, and reports the replies the comment still has', async () => {
    const { client, state } = fakeClient({
      comments: [
        comment({ uuid: 'root-1' }),
        comment({ uuid: 'reply-1', parent_uuid: 'root-1', user_uuid: OTHER }),
      ],
    });

    const result = await updateComment({
      client,
      uuid: 'root-1',
      content: 'Revised',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(true);
    expect(result.comment).toMatchObject({ content: 'Revised', replyCount: 1 });
    expect(state.comments[0].content).toBe('Revised');
  });

  it('refuses an editor who did not write the comment, without writing', async () => {
    const { client, state } = fakeClient({ comments: [comment()] });

    const result = await updateComment({
      client,
      uuid: 'root-1',
      content: 'Revised',
      userUuid: OTHER,
    });

    expect(result).toEqual({
      success: false,
      error: 'Permission denied: only the author can edit a comment',
    });
    expect(state.ops).not.toContain('update:comments');
    expect(state.comments[0].content).toBe('A note');
  });

  it('reports an error when the database filters the update away', async () => {
    const { client } = fakeClient({
      comments: [comment()],
      refuseWrites: true,
    });

    const result = await updateComment({
      client,
      uuid: 'root-1',
      content: 'Revised',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('refused');
  });
});

describe('resolveComment', () => {
  it('resolves a thread root', async () => {
    const { client, state } = fakeClient({ comments: [comment()] });

    const result = await resolveComment({
      client,
      uuid: 'root-1',
      resolved: true,
      userUuid: OTHER,
    });

    expect(result.success).toBe(true);
    expect(state.comments[0].resolved_by).toBe(OTHER);
    expect(state.comments[0].resolved_at).toEqual(expect.any(String));
  });

  it('un-resolves by clearing both halves of the pair', async () => {
    const { client, state } = fakeClient({
      comments: [
        comment({ resolved_at: '2026-09-15T12:00:00Z', resolved_by: OTHER }),
      ],
    });

    const result = await resolveComment({
      client,
      uuid: 'root-1',
      resolved: false,
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(true);
    expect(state.comments[0].resolved_at).toBeNull();
    expect(state.comments[0].resolved_by).toBeNull();
  });

  it('refuses a reply, which inherits its thread state', async () => {
    const { client, state } = fakeClient({
      comments: [
        comment({ uuid: 'root-1' }),
        comment({ uuid: 'reply-1', parent_uuid: 'root-1' }),
      ],
    });

    const result = await resolveComment({
      client,
      uuid: 'reply-1',
      resolved: true,
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('resolve its thread root instead');
    expect(state.ops).not.toContain('update:comments');
  });

  it('reports an error when the database filters the update away', async () => {
    const { client } = fakeClient({
      comments: [comment()],
      refuseWrites: true,
    });

    const result = await resolveComment({
      client,
      uuid: 'root-1',
      resolved: true,
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('refused');
  });
});

describe('deleteComment', () => {
  it('takes the replies with the root and names them all', async () => {
    const { client, state } = fakeClient({
      comments: [
        comment({ uuid: 'root-1' }),
        comment({ uuid: 'reply-1', parent_uuid: 'root-1', user_uuid: OTHER }),
        comment({ uuid: 'reply-2', parent_uuid: 'reply-1', user_uuid: OTHER }),
        comment({ uuid: 'root-2' }),
      ],
    });

    const result = await deleteComment({
      client,
      uuid: 'root-1',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(true);
    expect(result.deletedUuids.sort()).toEqual([
      'reply-1',
      'reply-2',
      'root-1',
    ]);
    expect(state.comments.map((row) => row.uuid)).toEqual(['root-2']);
  });

  it('names only the branch below a reply', async () => {
    const { client } = fakeClient({
      comments: [
        comment({ uuid: 'root-1' }),
        comment({ uuid: 'reply-1', parent_uuid: 'root-1' }),
        comment({ uuid: 'reply-2', parent_uuid: 'reply-1' }),
      ],
    });

    const result = await deleteComment({
      client,
      uuid: 'reply-1',
      userUuid: AUTHOR,
    });

    expect(result.deletedUuids.sort()).toEqual(['reply-1', 'reply-2']);
  });

  it('refuses an editor who did not write the comment, without writing', async () => {
    const { client, state } = fakeClient({ comments: [comment()] });

    const result = await deleteComment({
      client,
      uuid: 'root-1',
      userUuid: OTHER,
    });

    expect(result).toEqual({
      success: false,
      deletedUuids: [],
      error: 'Permission denied: only the author can delete a comment',
    });
    expect(state.comments).toHaveLength(1);
  });

  it('reports an error when the database filters the delete away', async () => {
    const { client, state } = fakeClient({
      comments: [comment()],
      refuseWrites: true,
    });

    const result = await deleteComment({
      client,
      uuid: 'root-1',
      userUuid: AUTHOR,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('refused');
    expect(state.comments).toHaveLength(1);
  });
});
