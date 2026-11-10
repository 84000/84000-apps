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
});
