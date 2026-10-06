import { renderHook } from '@testing-library/react';
import type { Virtualizer } from '@tanstack/react-virtual';

import { useStackScrollHandler } from './useStackScrollHandler';
import type { PassageStackController } from './PassageStackController';

type Handler = (index: number, options?: { settle?: boolean }) => void;

const setup = (scroller: HTMLElement | null) => {
  let handler: Handler | null = null;
  const controller = {
    setScrollHandler: (next: Handler | null) => {
      handler = next;
    },
    getOrder: () => ['p0', 'p1'],
    getVersion: () => 0,
    isHydrating: () => false,
  } as unknown as PassageStackController;
  const virtualizer = {
    measurementsCache: [
      { index: 0, start: 100 },
      { index: 1, start: 500 },
    ],
    scrollToIndex: jest.fn(),
    scrollToOffset: jest.fn(),
  } as unknown as Virtualizer<HTMLElement, Element>;
  renderHook(() => useStackScrollHandler(controller, virtualizer, scroller));
  return { handler: () => handler as unknown as Handler, virtualizer };
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
    const scroller = document.createElement('div');
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
    const { handler, virtualizer } = setup(document.createElement('div'));

    handler()(1, { settle: true });

    expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(420, {
      align: 'start',
    });
  });

  it('keeps a plain scroll to the row itself', () => {
    const { handler, virtualizer } = setup(document.createElement('div'));

    handler()(1);

    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(1, {
      align: 'auto',
    });
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });
});
