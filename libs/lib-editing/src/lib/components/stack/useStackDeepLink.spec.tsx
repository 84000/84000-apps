import { renderHook, waitFor } from '@testing-library/react';

import { useStackDeepLink } from './useStackDeepLink';
import type { PassageStackController } from './PassageStackController';

const mockNavigation = {
  panels: {} as Record<string, { open: boolean; tab?: string; hash?: string }>,
  updatePanel: jest.fn(),
  highlight: undefined as { start: number; end: number } | undefined,
};

jest.mock('../shared/NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));

/** Just enough controller for the hook: a tab, and a reveal it can record. */
const controllerFor = (tab?: string) => {
  const revealed: string[] = [];
  const controller = {
    getTab: () => tab,
    revealPassage: jest.fn(async (uuid: string) => {
      revealed.push(uuid);
      return true;
    }),
  } as unknown as PassageStackController;
  return { controller, revealed };
};

beforeEach(() => {
  mockNavigation.panels = {};
  mockNavigation.updatePanel.mockClear();
  mockNavigation.highlight = undefined;
});

describe('useStackDeepLink panel', () => {
  it('answers a hash addressed to the panel its tab belongs to', async () => {
    const { controller, revealed } = controllerFor('endnotes');
    mockNavigation.panels = {
      main: { open: true, tab: 'translation' },
      right: { open: true, tab: 'endnotes', hash: 'n-1' },
    };

    renderHook(() => useStackDeepLink(controller));

    // The endnotes tab lives in the right panel, so that is the hash it owns.
    await waitFor(() => expect(revealed).toEqual(['n-1']));
  });

  it('ignores a hash addressed to a panel it is not drawn in', async () => {
    const { controller, revealed } = controllerFor('endnotes');
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'p-1' },
      right: { open: true, tab: 'endnotes' },
    };

    renderHook(() => useStackDeepLink(controller));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revealed).toEqual([]);
  });

  it('keeps watching the main panel for the translation tab', async () => {
    const { controller, revealed } = controllerFor('translation');
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'p-7' },
      right: { open: true, tab: 'endnotes', hash: 'n-9' },
    };

    renderHook(() => useStackDeepLink(controller));

    await waitFor(() => expect(revealed).toEqual(['p-7']));
  });

  it('lets a host name the panel when it draws a tab somewhere else', async () => {
    const { controller, revealed } = controllerFor('endnotes');
    mockNavigation.panels = {
      main: { open: true, tab: 'endnotes', hash: 'n-2' },
      right: { open: true, tab: 'endnotes' },
    };

    renderHook(() => useStackDeepLink(controller, 'main'));

    await waitFor(() => expect(revealed).toEqual(['n-2']));
  });

  it('falls back to the main panel for a view with no tab', async () => {
    const { controller, revealed } = controllerFor(undefined);
    mockNavigation.panels = { main: { open: true, hash: 'p-3' } };

    renderHook(() => useStackDeepLink(controller));

    await waitFor(() => expect(revealed).toEqual(['p-3']));
  });

  it('clears the hash it consumed, so the same link can be followed twice', async () => {
    const { controller } = controllerFor('endnotes');
    mockNavigation.panels = {
      right: { open: true, tab: 'endnotes', hash: 'n-1' },
    };

    renderHook(() => useStackDeepLink(controller));

    await waitFor(() =>
      expect(mockNavigation.updatePanel).toHaveBeenCalledWith({
        name: 'right',
        state: { open: true, tab: 'endnotes', hash: undefined },
      }),
    );
  });
});
