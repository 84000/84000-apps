import { getAnchoredCommentUuids } from './anchors';
import type { DataClient } from '../types';

type RpcCall = { name: string; args: Record<string, unknown> };

const clientWith = ({
  rows = [],
  error,
  calls = [],
}: {
  rows?: { target_uuid: string | null }[];
  error?: { message: string };
  calls?: RpcCall[];
}) =>
  ({
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve({
        data: error ? null : rows,
        error: error ?? null,
      });
    },
  }) as unknown as DataClient;

describe('getAnchoredCommentUuids', () => {
  it('reports only the threads an annotation points at', async () => {
    const anchored = await getAnchoredCommentUuids({
      client: clientWith({
        rows: [{ target_uuid: 'a' }, { target_uuid: 'a' }],
      }),
      commentUuids: ['a', 'b'],
      source: 'draft',
    });

    expect([...anchored]).toEqual(['a']);
  });

  it('asks the draft RPC for comment annotations', async () => {
    const calls: RpcCall[] = [];

    await getAnchoredCommentUuids({
      client: clientWith({ calls }),
      commentUuids: ['a'],
      source: 'draft',
    });

    expect(calls).toEqual([
      {
        name: 'get_passage_annotations_by_content_uuids',
        args: { annotation_type: 'comment', target_uuids: ['a'] },
      },
    ]);
  });

  it('batches the uuid list so the request URL stays under the PostgREST cap', async () => {
    const calls: RpcCall[] = [];
    const uuids = Array.from({ length: 450 }, (_, i) => `c${i}`);

    await getAnchoredCommentUuids({
      client: clientWith({ calls }),
      commentUuids: uuids,
      source: 'draft',
    });

    expect(
      calls.map((call) => (call.args.target_uuids as string[]).length),
    ).toEqual([200, 200, 50]);
  });

  it('issues no query for a published read', async () => {
    const calls: RpcCall[] = [];

    const anchored = await getAnchoredCommentUuids({
      client: clientWith({ calls }),
      commentUuids: ['a'],
      source: 'published',
    });

    expect(anchored.size).toBe(0);
    expect(calls).toEqual([]);
  });

  it('treats every thread as anchored when the read fails', async () => {
    const anchored = await getAnchoredCommentUuids({
      client: clientWith({ error: { message: 'boom' } }),
      commentUuids: ['a', 'b'],
      source: 'draft',
    });

    expect([...anchored]).toEqual(['a', 'b']);
  });

  it('issues no query for an empty list', async () => {
    const calls: RpcCall[] = [];

    await getAnchoredCommentUuids({
      client: clientWith({ calls }),
      commentUuids: [],
      source: 'draft',
    });

    expect(calls).toEqual([]);
  });
});
