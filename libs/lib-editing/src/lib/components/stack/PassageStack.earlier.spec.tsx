import { act, render } from '@testing-library/react';
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStack } from './PassageStack';
import { PassageStackController } from './PassageStackController';
import { createStackWorkDocument } from './stack-work';
import { flush, seeds, source } from './stack-controller.fixture';
import { stackStartPx } from './StackEnd';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
// The footer's image needs Next's loader.
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  LotusPond: () => null,
}));

// jsdom has no ResizeObserver; nothing here depends on sizes.
beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
});

/** A stack whose feed says, until told otherwise, that earlier rows exist. */
const setup = () => {
  const all = seeds(2);
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
  });
  work.seedSpine(all.map((entry) => entry.meta));
  const feed = { hasMoreBefore: true };
  const controller = new PassageStackController({
    work,
    spineFeed: {
      hasMore: false,
      maybeExtend: () => false,
      get hasMoreBefore() {
        return feed.hasMoreBefore;
      },
      maybeExtendBefore: () => false,
    },
  });
  // A scroller of its own, with a scroll position jsdom will keep.
  const scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  let top = 0;
  Object.defineProperty(scroller, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = value;
    },
  });
  document.body.appendChild(scroller);
  const view = render(<PassageStack controller={controller} />, {
    container: scroller,
  });
  // Ends the earlier passages without adding any, as an empty read does.
  const endEarlier = () =>
    act(() => {
      feed.hasMoreBefore = false;
      controller.setActiveToh('another');
    });
  return { view, scroller, endEarlier };
};

describe('PassageStack earlier passages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('draws placeholders above the first row while there are some', async () => {
    const { view } = setup();
    await act(flush);

    expect(view.container.querySelector('[data-stack-start]')).not.toBeNull();
  });

  it('drops them once the feed has none, keeping the reader where they were', async () => {
    const { view, scroller, endEarlier } = setup();
    await act(flush);
    scroller.scrollTop = stackStartPx() + 100;

    await endEarlier();

    expect(view.container.querySelector('[data-stack-start]')).toBeNull();
    // Every row moved up by the placeholders' height, and so did the view.
    expect(scroller.scrollTop).toBe(100);
  });

  it('moves the view no further than the placeholders it had passed', async () => {
    const { scroller, endEarlier } = setup();
    await act(flush);
    scroller.scrollTop = 40;

    await endEarlier();

    expect(scroller.scrollTop).toBe(0);
  });
});
