import {
  capturePassageAnchor,
  restorePassageAnchor,
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
