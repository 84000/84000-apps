import { getGlossaryCommentEntries } from './glossary';
import type { DataClient } from '../types';

type Comment = {
  uuid: string;
  entity_uuid: string;
  entity_type: string;
  parent_uuid: string | null;
};

const comment = (
  uuid: string,
  entity_uuid: string,
  overrides: Partial<Comment> = {},
): Comment => ({
  uuid,
  entity_uuid,
  entity_type: 'glossary',
  parent_uuid: null,
  ...overrides,
});

/** The entries each work holds; the rpc keeps those of the work asked for. */
const fakeClient = ({
  comments,
  entries,
  commentsError,
  rpcError,
}: {
  comments: Comment[];
  entries: Record<string, string[]>;
  commentsError?: { message: string };
  rpcError?: { message: string };
}) => {
  const rpc = jest.fn(
    async (_name: string, args: { p_work_uuid: string; p_uuids: string[] }) =>
      rpcError
        ? { data: null, error: rpcError }
        : {
            data: args.p_uuids
              .filter((uuid) => entries[args.p_work_uuid]?.includes(uuid))
              .map((uuid) => ({
                uuid,
                work_uuid: args.p_work_uuid,
                authority_uuid: 'a',
                definition: null,
                definition_rend: null,
                gloss_mode: 'match',
                names: [],
              })),
            error: null,
          },
  );

  const query = (
    filters: ((row: Comment) => boolean)[] = [],
    window?: [number, number],
  ) => {
    const builder = {
      select: () => builder,
      order: () => builder,
      range: (from: number, to: number) => query(filters, [from, to]),
      eq: (column: keyof Comment, value: string) =>
        query([...filters, (row) => row[column] === value], window),
      is: (column: keyof Comment, value: null) =>
        query([...filters, (row) => row[column] === value], window),
      then: (resolve: (value: unknown) => unknown) => {
        const matching = [...comments]
          .sort((a, b) => a.entity_uuid.localeCompare(b.entity_uuid))
          .filter((row) => filters.every((f) => f(row)));
        return resolve(
          commentsError
            ? { data: null, error: commentsError }
            : {
                data: (window
                  ? matching.slice(window[0], window[1] + 1)
                  : matching
                ).map(({ entity_uuid }) => ({ entity_uuid })),
                error: null,
              },
        );
      },
    };
    return builder;
  };

  return { client: { from: () => query(), rpc } as unknown as DataClient, rpc };
};

describe('getGlossaryCommentEntries', () => {
  const manyEntries = (count: number) =>
    Array.from({ length: count }, (_, i) => `e${String(i).padStart(5, '0')}`);

  it('reads every page of threads', async () => {
    const uuids = manyEntries(1500);
    const { client } = fakeClient({
      comments: uuids.map((uuid, i) => comment(`c${i}`, uuid)),
      entries: { w1: uuids },
    });

    const entries = await getGlossaryCommentEntries({
      client,
      workUuid: 'w1',
    });

    expect(entries).toHaveLength(1500);
  });

  it('reads entries in batches that fit a request', async () => {
    const uuids = manyEntries(450);
    const { client, rpc } = fakeClient({
      comments: uuids.map((uuid, i) => comment(`c${i}`, uuid)),
      entries: { w1: uuids },
    });

    const entries = await getGlossaryCommentEntries({
      client,
      workUuid: 'w1',
    });

    expect(entries).toHaveLength(450);
    expect(rpc.mock.calls.map(([, args]) => args.p_uuids.length)).toEqual([
      200, 200, 50,
    ]);
  });

  it("lists the work's entries that carry a thread", async () => {
    const { client } = fakeClient({
      comments: [comment('c1', 'e1'), comment('c2', 'e3')],
      entries: { w1: ['e1', 'e2', 'e3'] },
    });

    const entries = await getGlossaryCommentEntries({
      client,
      workUuid: 'w1',
    });

    expect(entries?.map(({ uuid }) => uuid)).toEqual(['e1', 'e3']);
  });

  it('counts an entry once however many threads it has', async () => {
    const { client } = fakeClient({
      comments: [comment('c1', 'e1'), comment('c2', 'e1')],
      entries: { w1: ['e1'] },
    });

    const entries = await getGlossaryCommentEntries({
      client,
      workUuid: 'w1',
    });

    expect(entries?.map(({ uuid }) => uuid)).toEqual(['e1']);
  });

  it('leaves out other works, other entity types and replies', async () => {
    const { client } = fakeClient({
      comments: [
        comment('c1', 'other-work-entry'),
        comment('c2', 'e1', { entity_type: 'passage' }),
        comment('c3', 'e2', { parent_uuid: 'c9' }),
      ],
      entries: { w1: ['e1', 'e2'], w2: ['other-work-entry'] },
    });

    const entries = await getGlossaryCommentEntries({
      client,
      workUuid: 'w1',
    });

    expect(entries).toEqual([]);
  });

  it('asks the database for nothing when no entry has a thread', async () => {
    const { client, rpc } = fakeClient({ comments: [], entries: {} });

    expect(await getGlossaryCommentEntries({ client, workUuid: 'w1' })).toEqual(
      [],
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is null when a read fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => null);

    const failedComments = fakeClient({
      comments: [],
      entries: {},
      commentsError: { message: 'boom' },
    });
    const failedEntries = fakeClient({
      comments: [comment('c1', 'e1')],
      entries: { w1: ['e1'] },
      rpcError: { message: 'boom' },
    });

    expect(
      await getGlossaryCommentEntries({
        client: failedComments.client,
        workUuid: 'w1',
      }),
    ).toBeNull();
    expect(
      await getGlossaryCommentEntries({
        client: failedEntries.client,
        workUuid: 'w1',
      }),
    ).toBeNull();
    spy.mockRestore();
  });
});
