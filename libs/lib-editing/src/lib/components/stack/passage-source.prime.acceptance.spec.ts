import type { GraphQLClient } from 'graphql-request';
import { Spine } from '@eightyfourthousand/lib-doc-model';

import { graphqlPassageSource } from './passage-source';

// Acceptance tests for DEV-837 item 6b, section 6: `prime` on the source
// `graphqlPassageSource` returns (AC6.13 to AC6.16).
//
// Written from the spec, not the implementation. Only the two content reads
// are faked, as `passage-source.spec.ts` does.

jest.mock('@eightyfourthousand/client-graphql', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getTranslationBlocks: jest.Mock;
  getTranslationBlocksAround: jest.Mock;
};

const client = {} as GraphQLClient;

/** A spine of `count` passages, `p0` onward, all in one section. */
const spineOf = (count: number) => {
  const spine = new Spine('w1');
  spine.seed(
    Array.from({ length: count }, (_, i) => ({
      uuid: `p${i}`,
      label: `${i + 1}`,
      type: 'translation' as const,
    })),
  );
  return spine;
};

/** One page as a content read returns it. */
const page = (uuids: string[]) => ({
  blocks: uuids.map((uuid) => ({
    type: 'passage',
    attrs: { uuid },
    content: [{ type: 'paragraph' }],
  })),
  nextCursor: undefined,
  hasMoreAfter: false,
  hasMoreBefore: false,
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const sourceOver = (spine = spineOf(20)) =>
  graphqlPassageSource({ client, workUuid: 'w1', spine: () => spine });

/** Every content read made so far, of either kind. */
const contentReads = () =>
  clientGraphql.getTranslationBlocks.mock.calls.length +
  clientGraphql.getTranslationBlocksAround.mock.calls.length;

const uuids = (snapshots: { uuid: string }[]) =>
  snapshots.map((snapshot) => snapshot.uuid);

beforeEach(() => {
  clientGraphql.getTranslationBlocks.mockReset();
  clientGraphql.getTranslationBlocksAround.mockReset();
});

describe('graphqlPassageSource prime', () => {
  it('AC6.13: reads around the target once, with a small limit', () => {
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p8', 'p9', 'p10']),
    );
    const source = sourceOver();

    source.prime('p9');

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(1);
    const options = clientGraphql.getTranslationBlocksAround.mock.calls[0][0];
    expect(options.passageUuid).toBe('p9');
    // The limit is `maxPassages` on this client; `limit` is the GraphQL name.
    const limit = options.maxPassages ?? options.limit;
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(10);
  });

  it('AC6.13: a later load of the target returns it from that read and makes no other content read', async () => {
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p8', 'p9', 'p10']),
    );
    const source = sourceOver();

    source.prime('p9');
    const found = await source.loadPassages('w1', ['p9']);

    expect(uuids(found)).toEqual(['p9']);
    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(1);
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
  });

  it('AC6.13: the passage it returns carries the content that read supplied', async () => {
    clientGraphql.getTranslationBlocksAround.mockResolvedValue({
      ...page(['p9']),
      blocks: [
        {
          type: 'passage',
          attrs: { uuid: 'p9' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'primed' }] },
          ],
        },
      ],
    });
    const source = sourceOver();

    source.prime('p9');
    const [snapshot] = await source.loadPassages('w1', ['p9']);

    expect(JSON.stringify(snapshot.content)).toContain('primed');
  });

  it('AC6.13: loads made before the primed read settles wait for it rather than reading again', async () => {
    const read = deferred<ReturnType<typeof page>>();
    clientGraphql.getTranslationBlocksAround.mockReturnValue(read.promise);
    const source = sourceOver();

    source.prime('p9');
    const loading = source.loadPassages('w1', ['p9']);
    read.resolve(page(['p8', 'p9', 'p10']));

    expect(uuids(await loading)).toEqual(['p9']);
    expect(contentReads()).toBe(1);
  });

  it('AC6.14: hands a primed passage out once; a second load reads it in the usual way', async () => {
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p8', 'p9', 'p10']),
    );
    clientGraphql.getTranslationBlocks.mockResolvedValue(page(['p9']));
    const source = sourceOver();

    source.prime('p9');
    await source.loadPassages('w1', ['p9']);
    expect(contentReads()).toBe(1);

    const again = await source.loadPassages('w1', ['p9']);

    expect(uuids(again)).toEqual(['p9']);
    // One more content read than before, and not the primed one again.
    expect(contentReads()).toBe(2);
    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(1);
  });

  it('AC6.15: reads the passages the primed read did not return in the usual way', async () => {
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p8', 'p9']),
    );
    clientGraphql.getTranslationBlocks.mockResolvedValue(page(['p10']));
    const source = sourceOver();

    source.prime('p9');
    const found = await source.loadPassages('w1', ['p9', 'p10']);

    expect(uuids(found).sort()).toEqual(['p10', 'p9']);
    // p9 came from the primed read, and only p10 needed another.
    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(1);
    expect(contentReads()).toBe(2);
    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledTimes(1);
  });

  it('AC6.15: a load that leaves out the primed target resolves while the primed read is pending', async () => {
    const read = deferred<ReturnType<typeof page>>();
    clientGraphql.getTranslationBlocksAround.mockReturnValue(read.promise);
    clientGraphql.getTranslationBlocks.mockResolvedValue(page(['p3']));
    const source = sourceOver();

    source.prime('p9');
    const outcome = await Promise.race([
      source.loadPassages('w1', ['p3']),
      new Promise<'timed out'>((resolve) =>
        setTimeout(() => resolve('timed out'), 250),
      ),
    ]);

    expect(outcome).not.toBe('timed out');
    expect(uuids(outcome as { uuid: string }[])).toEqual(['p3']);

    // The primed read is still good once it settles.
    read.resolve(page(['p8', 'p9', 'p10']));
    const reads = contentReads();
    expect(uuids(await source.loadPassages('w1', ['p9']))).toEqual(['p9']);
    expect(contentReads()).toBe(reads);
  });

  it('AC6.16: a failed primed read leaves the target to a usual read', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {
      /* a failed read may be logged */
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {
      /* a failed read may be logged */
    });
    // The first around read is the primed one; any usual read that is also an
    // around read succeeds.
    clientGraphql.getTranslationBlocksAround
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(page(['p9']));
    clientGraphql.getTranslationBlocks.mockResolvedValue(page(['p9']));
    const source = sourceOver();

    source.prime('p9');
    const found = await source.loadPassages('w1', ['p9']);

    expect(uuids(found)).toEqual(['p9']);
    // Something other than the failed primed read supplied it.
    expect(contentReads()).toBeGreaterThanOrEqual(2);

    quiet.mockRestore();
    warn.mockRestore();
  });
});
