import { renderHook } from '@testing-library/react';

import {
  capturePassageAnchor,
  recordPassageAnchor,
  restorePassageAnchor,
  usePassageAnchorRestore,
  type PassageAnchors,
} from './useScrollPositionRestore';

// jsdom has no CSS.escape; the uuids here need no escaping.
if (typeof CSS === 'undefined') {
  (globalThis as { CSS?: unknown }).CSS = { escape: (value: string) => value };
}

/** An element with a fixed box, since jsdom lays nothing out. */
const boxed = (html: string, top: number, height: number) => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const el = wrapper.firstElementChild as HTMLElement;
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height }) as DOMRect;
  return el;
};

const container = (...children: HTMLElement[]) => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  children.forEach((child) => el.append(child));
  return el;
};

describe('capturePassageAnchor', () => {
  it.each([
    [
      'a paginated passage',
      '<div data-passage-type="translation" id="p2"></div>',
    ],
    ['a stack row', '<div data-stack-passage="p2" id="p2"></div>'],
  ])('finds the first visible %s', (_, html) => {
    const scroller = container(
      boxed(html.replace(/p2/g, 'p1'), 0, 50),
      boxed(html, 120, 50),
    );
    expect(capturePassageAnchor(scroller)).toEqual({
      uuid: 'p2',
      offsetFromViewport: 20,
    });
  });

  it('skips a hidden copy of a passage', () => {
    const scroller = container(
      boxed('<div data-stack-passage="p1" id="p1"></div>', 0, 0),
      boxed('<div data-stack-passage="p2" id="p2"></div>', 120, 50),
    );
    expect(capturePassageAnchor(scroller)?.uuid).toBe('p2');
  });
});

describe('recordPassageAnchor', () => {
  const scroller = () =>
    container(boxed('<div data-stack-passage="f1" id="f1"></div>', 120, 50));

  it("keeps a tab's anchor apart from the others", () => {
    const anchors: PassageAnchors = {
      translation: { uuid: 'p1', offsetFromViewport: 0 },
    };
    recordPassageAnchor(anchors, 'front', scroller());
    expect(anchors).toEqual({
      translation: { uuid: 'p1', offsetFromViewport: 0 },
      front: { uuid: 'f1', offsetFromViewport: 20 },
    });
  });

  it('files Compare under Translation, and ignores tabs without passages', () => {
    const anchors: PassageAnchors = {};
    recordPassageAnchor(anchors, 'compare', scroller());
    recordPassageAnchor(anchors, 'source', scroller());
    recordPassageAnchor(anchors, 'glossary', scroller());
    expect(Object.keys(anchors)).toEqual(['translation']);
  });

  // The right panel's stacked tabs share its scroller with the glossary.
  it('anchors the Notes and Abbreviations tabs', () => {
    const anchors: PassageAnchors = {};
    recordPassageAnchor(anchors, 'endnotes', scroller());
    recordPassageAnchor(anchors, 'abbreviations', scroller());
    expect(Object.keys(anchors)).toEqual(['endnotes', 'abbreviations']);
  });
});

describe('restorePassageAnchor', () => {
  it('says whether the passage was there to align on', () => {
    const scroller = container(
      boxed('<div data-stack-passage="p1" id="p1"></div>', 150, 50),
    );
    expect(
      restorePassageAnchor(scroller, { uuid: 'p1', offsetFromViewport: 20 }),
    ).toBe(true);
    expect(scroller.scrollTop).toBe(30);
    expect(
      restorePassageAnchor(scroller, { uuid: 'gone', offsetFromViewport: 0 }),
    ).toBe(false);
  });
});

describe('usePassageAnchorRestore', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /**
   * Leave Translation for Front with p1 anchored 20px down, then come back.
   * `row.top` is where the row sits, which moves as rows above it load.
   */
  const returnToTranslation = () => {
    const row = { top: 150 };
    const el = boxed('<div data-stack-passage="p1" id="p1"></div>', 0, 50);
    el.getBoundingClientRect = () =>
      ({ top: row.top, bottom: row.top + 50, height: 50 }) as DOMRect;
    const scroller = container(el);
    document.body.append(scroller);
    const ref = { current: scroller };
    const hook = renderHook(
      ({ tab, hash }) => usePassageAnchorRestore(ref, tab, 'main', hash),
      { initialProps: { tab: 'front', hash: false } },
    );
    hook.result.current.current.translation = {
      uuid: 'p1',
      offsetFromViewport: 20,
    };
    hook.rerender({ tab: 'translation', hash: false });
    jest.advanceTimersToNextFrame();
    return { row, scroller, hook };
  };

  it('keeps the anchor in place while the rows above it load', () => {
    const { row, scroller } = returnToTranslation();
    expect(scroller.scrollTop).toBe(30);

    row.top = 200;
    jest.advanceTimersByTime(50);
    expect(scroller.scrollTop).toBe(110);
  });

  it.each([
    ['leaving the tab', { tab: 'front', hash: false }],
    ['following a hash', { tab: 'translation', hash: true }],
  ])('stops settling on %s', (_, props) => {
    const { row, scroller, hook } = returnToTranslation();
    hook.rerender(props);

    row.top = 200;
    jest.advanceTimersByTime(1000);
    expect(scroller.scrollTop).toBe(30);
  });

  // Front is a tab of passages too, and leaving it must not cost
  // Translation the anchor it left.
  it('restores each tab by its own anchor', () => {
    const translationRow = boxed(
      '<div data-stack-passage="p1" id="p1"></div>',
      150,
      50,
    );
    const frontRow = boxed(
      '<div data-stack-passage="f1" id="f1"></div>',
      400,
      50,
    );
    const scroller = container(translationRow, frontRow);
    document.body.append(scroller);
    const ref = { current: scroller };
    const hook = renderHook(
      ({ tab }) => usePassageAnchorRestore(ref, tab, 'main', false),
      { initialProps: { tab: 'translation' } },
    );
    hook.result.current.current.translation = {
      uuid: 'p1',
      offsetFromViewport: 20,
    };
    hook.result.current.current.front = { uuid: 'f1', offsetFromViewport: 0 };

    hook.rerender({ tab: 'front' });
    jest.advanceTimersToNextFrame();
    expect(scroller.scrollTop).toBe(300);

    scroller.scrollTop = 0;
    hook.rerender({ tab: 'translation' });
    jest.advanceTimersToNextFrame();
    expect(scroller.scrollTop).toBe(30);
    scroller.remove();
  });

  // A table of contents link into Front, or a deep link into Translation.
  it.each(['front', 'translation'])(
    'arriving at %s with a hash drops the anchor and leaves the scroll to the link',
    (tab) => {
      const row = boxed('<div data-stack-passage="a1" id="a1"></div>', 400, 50);
      const scroller = container(row);
      document.body.append(scroller);
      const ref = { current: scroller };
      const hook = renderHook(
        ({ tab, hash }) => usePassageAnchorRestore(ref, tab, 'main', hash),
        { initialProps: { tab: 'source', hash: false } },
      );
      hook.result.current.current[tab] = { uuid: 'a1', offsetFromViewport: 0 };

      hook.rerender({ tab, hash: true });
      jest.advanceTimersByTime(1000);

      expect(scroller.scrollTop).toBe(0);
      expect(hook.result.current.current[tab]).toBeUndefined();
      scroller.remove();
    },
  );

  it('restores Abbreviations by its anchor in the right panel', () => {
    const row = boxed('<div data-stack-passage="a1" id="a1"></div>', 250, 50);
    const scroller = container(row);
    document.body.append(scroller);
    const ref = { current: scroller };
    const hook = renderHook(
      ({ tab }) => usePassageAnchorRestore(ref, tab, 'right', false),
      { initialProps: { tab: 'glossary' } },
    );
    hook.result.current.current.abbreviations = {
      uuid: 'a1',
      offsetFromViewport: 0,
    };

    hook.rerender({ tab: 'abbreviations' });
    jest.advanceTimersToNextFrame();
    expect(scroller.scrollTop).toBe(150);
    scroller.remove();
  });

  it('stops settling on unmount', () => {
    const { row, scroller, hook } = returnToTranslation();
    hook.unmount();

    row.top = 200;
    jest.advanceTimersByTime(1000);
    expect(scroller.scrollTop).toBe(30);
  });
});
