import { getTaggedComments, getTaggedCommentWorks } from './tagged';
import type { CommentDTO, DataClient } from '../types';

type Result = { data: unknown[] | null; error: { message: string } | null };

/** A thenable that also accepts the chained modifiers a read applies. */
const chain = (result: Result) => {
  const builder = {
    select: () => builder,
    in: () => builder,
    order: () => builder,
    range: () => builder,
    then: (resolve: (value: Result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
};

const row = (overrides: Partial<CommentDTO> = {}): CommentDTO => ({
  uuid: 'root-1',
  entity_uuid: 'p1',
  entity_type: 'passage',
  content: '<p>Link Toh 123 once published</p>',
  user_uuid: 'u1',
  created_at: '2026-09-22T00:00:00Z',
  updated_at: '2026-09-22T00:00:00Z',
  parent_uuid: null,
  resolved_at: null,
  resolved_by: null,
  tags: [],
  ...overrides,
});

const fakeClient = ({
  tagged = [],
  scope = [],
  anchors = [],
  taggedError,
  anchorError,
  rpcCalls = [],
}: {
  tagged?: (CommentDTO & { work_uuid: string })[];
  scope?: CommentDTO[];
  anchors?: { passage_uuid: string; target_uuid: string }[];
  taggedError?: { message: string };
  anchorError?: { message: string };
  rpcCalls?: { name: string; args: Record<string, unknown> }[];
}) =>
  ({
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return name === 'get_tagged_comments'
        ? chain({
            data: taggedError ? null : tagged,
            error: taggedError ?? null,
          })
        : chain({
            data: anchorError ? null : anchors,
            error: anchorError ?? null,
          });
    },
    from: () => chain({ data: scope, error: null }),
  }) as unknown as DataClient;

describe('getTaggedComments', () => {
  it('places a tagged reply in its thread and at its anchors', async () => {
    const root = row();
    const reply = row({
      uuid: 'reply-1',
      parent_uuid: 'root-1',
      tags: ['pending'],
    });

    const [tagged, ...rest] = await getTaggedComments({
      client: fakeClient({
        tagged: [{ ...reply, work_uuid: 'w1' }],
        scope: [root, reply],
        anchors: [{ passage_uuid: 'p2', target_uuid: 'root-1' }],
      }),
      tag: 'pending',
      workUuid: 'w1',
      source: 'draft',
    });

    expect(rest).toEqual([]);
    expect(tagged).toMatchObject({
      workUuid: 'w1',
      threadUuid: 'root-1',
      passageUuids: ['p2'],
      comment: { uuid: 'reply-1', tags: ['pending'], parentUuid: 'root-1' },
    });
    expect('work_uuid' in tagged.comment).toBe(false);
  });

  it('falls back to the passage a thread was written on when nothing anchors it', async () => {
    const root = row({ tags: ['pending'] });

    const [tagged] = await getTaggedComments({
      client: fakeClient({
        tagged: [{ ...root, work_uuid: 'w1' }],
        scope: [root],
      }),
      tag: 'pending',
      workUuid: 'w1',
      source: 'draft',
    });

    expect(tagged.passageUuids).toEqual(['p1']);
  });

  it('passes the work through', async () => {
    const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

    await getTaggedComments({
      client: fakeClient({ rpcCalls }),
      tag: 'pending',
      workUuid: 'w1',
      source: 'draft',
    });

    expect(rpcCalls.map(({ args }) => args)).toEqual([
      { p_tag: 'pending', p_work_uuid: 'w1' },
    ]);
  });

  it('normalizes the tag it asks for', async () => {
    const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

    await getTaggedComments({
      client: fakeClient({ rpcCalls }),
      tag: ' Pending ',
      workUuid: 'w1',
      source: 'draft',
    });

    expect(rpcCalls[0].args).toMatchObject({ p_tag: 'pending' });
  });

  it('issues no query for a published read', async () => {
    const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

    const tagged = await getTaggedComments({
      client: fakeClient({ rpcCalls }),
      tag: 'pending',
      workUuid: 'w1',
      source: 'published',
    });

    expect(tagged).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });

  it('returns empty when the read fails', async () => {
    const tagged = await getTaggedComments({
      client: fakeClient({ taggedError: { message: 'boom' } }),
      tag: 'pending',
      workUuid: 'w1',
      source: 'draft',
    });

    expect(tagged).toEqual([]);
  });

  it('still lists the comment when its anchors cannot be read', async () => {
    const root = row({ tags: ['pending'] });

    const tagged = await getTaggedComments({
      client: fakeClient({
        tagged: [{ ...root, work_uuid: 'w1' }],
        scope: [root],
        anchorError: { message: 'boom' },
      }),
      tag: 'pending',
      workUuid: 'w1',
      source: 'draft',
    });

    expect(tagged.map(({ passageUuids }) => passageUuids)).toEqual([['p1']]);
  });
});

describe('getTaggedCommentWorks', () => {
  it('counts per work, newest activity first, without reading threads', async () => {
    const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
    const client = fakeClient({
      rpcCalls,
      tagged: [
        {
          ...row({ uuid: 'a', created_at: '2026-09-01T00:00:00Z' }),
          work_uuid: 'w1',
        },
        {
          ...row({ uuid: 'b', created_at: '2026-09-02T00:00:00Z' }),
          work_uuid: 'w2',
        },
        {
          ...row({ uuid: 'c', created_at: '2026-09-03T00:00:00Z' }),
          work_uuid: 'w1',
        },
      ],
    });

    const works = await getTaggedCommentWorks({
      client,
      tag: ' Pending ',
      source: 'draft',
    });

    expect(works).toEqual([
      { workUuid: 'w1', count: 2, latestAt: '2026-09-03T00:00:00Z' },
      { workUuid: 'w2', count: 1, latestAt: '2026-09-02T00:00:00Z' },
    ]);
    expect(rpcCalls).toEqual([
      {
        name: 'get_tagged_comments',
        args: { p_tag: 'pending', p_work_uuid: null },
      },
    ]);
  });

  it('reads nothing for a published source', async () => {
    const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
    const client = fakeClient({ rpcCalls });

    expect(
      await getTaggedCommentWorks({
        client,
        tag: 'pending',
        source: 'published',
      }),
    ).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });
});
