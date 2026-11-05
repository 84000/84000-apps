import { renderHook } from '@testing-library/react';
import type { Virtualizer } from '@tanstack/react-virtual';

import { useStackScrollHandler } from './useStackScrollHandler';
import type { PassageStackController } from './PassageStackController';

type Handler = (index: number, options?: { settle?: boolean }) => void;

/** A scroller that is laid out, as the copy on show has. */
const laidOut = (scroller = document.createElement('div')) => {
  scroller.getClientRects = () => [{}] as unknown as DOMRectList;
  return scroller;
};

const virtualizerStub = () =>
  ({
    measurementsCache: [
      { index: 0, start: 100 },
      { index: 1, start: 500 },
    ],
    scrollToIndex: jest.fn(),
    scrollToOffset: jest.fn(),
  }) as unknown as Virtualizer<HTMLElement, Element>;

/**
 * A controller whose handlers fan out as the real one's do: every copy of a
 * view installs its own.
 */
const controllerStub = () => {
  const handlers = new Set<Handler>();
  const controller = {
    addScrollHandler: (handler: Handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getOrder: () => ['p0', 'p1'],
    getVersion: () => 0,
    isHydrating: () => false,
  } as unknown as PassageStackController;
  const scrollTo: Handler = (index, options) =>
    handlers.forEach((handler) => handler(index, options));
  return { controller, scrollTo, handlers };
};

const setup = (scroller: HTMLElement | null) => {
  const { controller, scrollTo } = controllerStub();
  const virtualizer = virtualizerStub();
  renderHook(() => useStackScrollHandler(controller, virtualizer, scroller));
  return { handler: () => scrollTo, virtualizer };
};

describe('useStackScrollHandler', () => {
  let raf: jest.SpyInstance;
  beforeEach(() => {
    // One frame is enough to see where the settle loop scrolls.
    raf = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 0);
  });
  afterEach(() => raf.mockRestore());

  // The paginated editor reveals a passage with `scrollIntoView`, which leaves
  // the row's scroll margin above it rather than pinning it to the edge.
  it('leaves the row scroll margin above a revealed passage', () => {
    const scroller = laidOut();
    const row = document.createElement('div');
    row.dataset['stackPassage'] = 'p1';
    row.style.scrollMarginTop = '40px';
    scroller.appendChild(row);
    const { handler, virtualizer } = setup(scroller);

    handler()(1, { settle: true });

    expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(460, {
      align: 'start',
    });
  });

  it('uses the default margin for a row not drawn yet', () => {
    const { handler, virtualizer } = setup(laidOut());

    handler()(1, { settle: true });

    expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(420, {
      align: 'start',
    });
  });

  it('keeps a row margin of zero rather than the default', () => {
    const scroller = laidOut();
    const row = document.createElement('div');
    row.dataset['stackPassage'] = 'p1';
    row.style.scrollMarginTop = '0px';
    scroller.appendChild(row);
    const { handler, virtualizer } = setup(scroller);

    handler()(1, { settle: true });

    expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(500, {
      align: 'start',
    });
  });

  // A reveal can swap the window before the virtualizer has laid it out.
  it('falls back to the row itself before it is laid out', () => {
    const { handler, virtualizer } = setup(laidOut());
    (
      virtualizer as unknown as { measurementsCache: unknown[] }
    ).measurementsCache = [];

    handler()(1, { settle: true });

    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(1, {
      align: 'start',
    });
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });

  it('keeps a plain scroll to the row itself', () => {
    const { handler, virtualizer } = setup(laidOut());

    handler()(1);

    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(1, {
      align: 'auto',
    });
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });

  // DEV-847: the layout draws the stack twice over one controller, desktop and
  // mobile, and a breakpoint hides one. A single handler slot went to the copy
  // that installed last; when that was the hidden one, a link to a passage
  // outside the window swapped the window and scrolled a list nobody saw.
  describe('with a copy of the view the layout hides', () => {
    it('scrolls the copy on show, whichever installed last', () => {
      const { controller, scrollTo } = controllerStub();
      const shown = virtualizerStub();
      const hidden = virtualizerStub();
      renderHook(() => useStackScrollHandler(controller, shown, laidOut()));
      // A scroller inside `display: none` has no boxes.
      renderHook(() =>
        useStackScrollHandler(
          controller,
          hidden,
          document.createElement('div'),
        ),
      );

      scrollTo(1, { settle: true });
      scrollTo(0);

      expect(shown.scrollToOffset).toHaveBeenCalledWith(420, {
        align: 'start',
      });
      expect(shown.scrollToIndex).toHaveBeenCalledWith(0, { align: 'auto' });
      expect(hidden.scrollToOffset).not.toHaveBeenCalled();
      expect(hidden.scrollToIndex).not.toHaveBeenCalled();
    });

    it('keeps the shown copy installed when the hidden one unmounts', () => {
      const { controller, scrollTo, handlers } = controllerStub();
      const shown = virtualizerStub();
      renderHook(() => useStackScrollHandler(controller, shown, laidOut()));
      const hidden = renderHook(() =>
        useStackScrollHandler(
          controller,
          virtualizerStub(),
          document.createElement('div'),
        ),
      );

      hidden.unmount();
      scrollTo(1);

      expect(handlers.size).toBe(1);
      expect(shown.scrollToIndex).toHaveBeenCalledWith(1, { align: 'auto' });
    });
  });
});
