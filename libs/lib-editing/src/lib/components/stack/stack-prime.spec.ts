import type { GraphQLClient } from 'graphql-request';

import { PassageStackController } from './PassageStackController';
import { StackController } from './StackController';
import type { PassageStackControllerOptions } from './types';
import { createStackWork } from './stack-work';
import { seeds } from './stack-controller.fixture';

// See PassageStackController.spec.ts: the stack schema reaches
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

const { getTranslationBlocks, getTranslationBlocksAround } = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as { getTranslationBlocks: jest.Mock; getTranslationBlocksAround: jest.Mock };

/** A feed whose reveal waits until told to place the passage. */
const heldFeed = () => {
  let place: () => void = () => undefined;
  const placed = new Promise<void>((resolve) => (place = resolve));
  const spineFeed = {
    maybeExtend: () => false,
    reveal: jest.fn(async () => {
      await placed;
      return -1;
    }),
  } as unknown as PassageStackControllerOptions['spineFeed'];
  return { spineFeed, place };
};

const work = () => {
  const built = createStackWork({
    workUuid: 'work-1',
    client: {} as GraphQLClient,
  });
  built.seedSpine(seeds(3).map((entry) => entry.meta));
  return built;
};

beforeEach(() => {
  getTranslationBlocks.mockReset().mockResolvedValue({ blocks: [] });
  getTranslationBlocksAround.mockReset().mockResolvedValue({ blocks: [] });
});

describe('revealing a passage the spine has not placed', () => {
  it("starts reading it alongside the spine's own read, in a reader", async () => {
    const { spineFeed, place } = heldFeed();
    const view = new StackController({ work: work(), spineFeed });

    const revealed = view.revealPassage('far-away');

    expect(getTranslationBlocksAround).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'work-1', passageUuid: 'far-away' }),
    );
    place();
    await revealed;
    view.destroy();
  });

  it('reads nothing ahead in an editor', async () => {
    const { spineFeed, place } = heldFeed();
    const view = new PassageStackController({ work: work(), spineFeed });

    const revealed = view.revealPassage('far-away');

    expect(getTranslationBlocksAround).not.toHaveBeenCalled();
    place();
    await revealed;
    view.destroy();
  });

  it('reads nothing ahead for a passage the spine holds', async () => {
    const { spineFeed } = heldFeed();
    const view = new StackController({ work: work(), spineFeed });

    await view.revealPassage('p1');

    expect(getTranslationBlocksAround).not.toHaveBeenCalled();
    view.destroy();
  });
});
