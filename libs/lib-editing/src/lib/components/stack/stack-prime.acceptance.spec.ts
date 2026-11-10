import type { GraphQLClient } from 'graphql-request';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { StackController } from './StackController';
import { createStackWork } from './stack-work';
import { flush, seeds } from './stack-controller.fixture';
import type { StackRowFeed } from './types';

// Acceptance tests for DEV-837 item 6b, section 7: a reader's controller starts
// a small content read around a deep link's target while the spine feed's
// `reveal` is still pending, and an editor's does not (AC6.17 to AC6.19).
//
// Written from the spec, not the implementation. The work is the real
// `createStackWork` over a fake client-graphql; the spine feed is a stub whose
// `reveal` the test settles.

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
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
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const meta = (index: number) => ({
  uuid: `p${index}`,
  label: `${index + 1}`,
  type: 'translation' as const,
});

/**
 * A work over the fake client whose spine holds `p0` to `p4`, and a feed whose
 * `reveal` waits for the test. Settling it places `p8` to `p10` in the spine,
 * as the real feed's `AROUND` read does.
 */
const setup = () => {
  const work: WorkDocument = createStackWork({ workUuid: 'w1', client });
  work.seedSpine(seeds(5).map((entry) => entry.meta));

  const gate = deferred<void>();
  const feed: StackRowFeed = {
    hasMore: false,
    maybeExtend: () => false,
    reveal: jest.fn(async (uuid: string) => {
      await gate.promise;
      work.seedSpine([8, 9, 10].map(meta));
      return work.spine.indexOf(uuid);
    }),
  };
  return { work, feed, settleReveal: gate.resolve };
};

/** The usual read: `maxPassages` passages after `cursor`, in the work's order. */
const forward = async ({
  cursor,
  maxPassages = 1,
}: {
  cursor?: string;
  maxPassages?: number;
}) => {
  const start = cursor ? Number(cursor.slice(1)) + 1 : 0;
  return page(Array.from({ length: maxPassages }, (_, i) => `p${start + i}`));
};

beforeEach(() => {
  clientGraphql.getTranslationBlocks.mockReset().mockImplementation(forward);
  clientGraphql.getTranslationBlocksAround
    .mockReset()
    .mockImplementation(async () => page(['p8', 'p9', 'p10']));
});

describe('a reader revealing a passage the spine has not placed', () => {
  it('AC6.17: the passage is then read from that read, not read again', async () => {
    const { work, feed, settleReveal } = setup();
    const controller = new StackController({ work, spineFeed: feed });

    const revealing = controller.revealPassage('p9');
    await flush();
    settleReveal();
    await revealing;

    expect(controller.isHydrated('p9')).toBe(true);
    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(1);
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
    controller.destroy();
  });
});
