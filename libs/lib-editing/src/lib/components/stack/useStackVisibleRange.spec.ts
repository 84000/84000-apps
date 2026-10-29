import { act, renderHook } from '@testing-library/react';

import { useStackVisibleRange } from './useStackVisibleRange';
import type { PassageStackController } from './PassageStackController';

/** The observers created, so a test can report a box change. */
const observers: (() => void)[] = [];

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(private readonly callback: () => void) {
      observers.push(() => this.callback());
    }
    observe() {
      // The test fires the callback itself.
    }
    disconnect() {
      // Nothing to release.
    }
  };
});

beforeEach(() => {
  observers.length = 0;
});

/** A root whose box is present or absent, as `display: none` makes it. */
const rootFor = (drawn: { value: boolean }) => {
  const element = document.createElement('div');
  element.getClientRects = () =>
    (drawn.value ? [{}] : []) as unknown as DOMRectList;
  return { current: element };
};

const setup = (drawn: { value: boolean }) => {
  const setVisibleRange = jest.fn();
  const controller = { setVisibleRange } as unknown as PassageStackController;
  const ref = rootFor(drawn);
  const hook = renderHook(
    ({ start, end }) =>
      useStackVisibleRange(controller, ref, { count: 50, start, end }),
    { initialProps: { start: 0, end: 10 } },
  );
  return { setVisibleRange, hook };
};

describe('useStackVisibleRange', () => {
  it('reports the drawn rows of a stack that is shown', () => {
    const { setVisibleRange } = setup({ value: true });
    expect(setVisibleRange).toHaveBeenCalledWith({ start: 0, end: 10 });
  });

  // The hidden tab reads the shown one's scroll offset.
  it('reports nothing while its tab is hidden, however far it scrolls', () => {
    const { setVisibleRange, hook } = setup({ value: false });
    hook.rerender({ start: 40, end: 50 });
    expect(setVisibleRange).not.toHaveBeenCalled();
  });

  it('reports the range once its tab is shown, and stops when hidden', () => {
    const drawn = { value: false };
    const { setVisibleRange, hook } = setup(drawn);

    drawn.value = true;
    act(() => observers.forEach((notify) => notify()));
    expect(setVisibleRange).toHaveBeenLastCalledWith({ start: 0, end: 10 });

    drawn.value = false;
    act(() => observers.forEach((notify) => notify()));
    hook.rerender({ start: 40, end: 50 });
    expect(setVisibleRange).toHaveBeenCalledTimes(1);
  });
});
