import { act, renderHook } from '@testing-library/react';

import { useStackOuterContent } from './useStackOuterContent';
import type { PassageStackController } from './PassageStackController';

const mockNavigation = { setShowOuterContent: jest.fn() };

jest.mock('../shared/NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));

/** A front view whose window does or does not start at the first passage. */
const frontView = (earlier: boolean) => {
  const listeners = new Set<() => void>();
  const state = { earlier };
  const controller = {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hasEarlierPassages: () => state.earlier,
  } as unknown as PassageStackController;
  const move = (to: boolean) => {
    state.earlier = to;
    listeners.forEach((listener) => listener());
  };
  return { controller, move };
};

beforeEach(() => mockNavigation.setShowOuterContent.mockClear());

describe('useStackOuterContent', () => {
  it('shows the titles over a front stack that starts at the top', () => {
    const { controller } = frontView(false);
    renderHook(() => useStackOuterContent(controller));
    expect(mockNavigation.setShowOuterContent).toHaveBeenLastCalledWith(true);
  });

  // A deep link into the middle of the front matter.
  it('hides them over a window opened part way through', () => {
    const { controller } = frontView(true);
    renderHook(() => useStackOuterContent(controller));
    expect(mockNavigation.setShowOuterContent).toHaveBeenLastCalledWith(false);
  });

  it('shows them again once the window reaches the top', () => {
    const { controller, move } = frontView(true);
    renderHook(() => useStackOuterContent(controller));

    act(() => move(false));

    expect(mockNavigation.setShowOuterContent).toHaveBeenLastCalledWith(true);
  });

  it('puts the default back when the front stack goes', () => {
    const { controller } = frontView(true);
    const { unmount } = renderHook(() => useStackOuterContent(controller));

    unmount();

    expect(mockNavigation.setShowOuterContent).toHaveBeenLastCalledWith(true);
  });

  it('leaves it alone for any other tab', () => {
    renderHook(() => useStackOuterContent(null));
    expect(mockNavigation.setShowOuterContent).not.toHaveBeenCalled();
  });
});
