import { renderHook, waitFor } from '@testing-library/react';

import { useStackDeepLink } from './useStackDeepLink';
import type { PassageStackController } from './PassageStackController';

const mockNavigation = {
  panels: {} as Record<string, { open: boolean; tab?: string; hash?: string }>,
  updatePanel: jest.fn(),
  highlight: undefined as { start: number; end: number } | undefined,
};

jest.mock('@eightyfourthousand/lib-utils', () => ({
  highlightTextRange: jest.fn(() => true),
  clearTextRangeHighlight: jest.fn(),
}));

const libUtils = jest.requireMock('@eightyfourthousand/lib-utils') as {
  highlightTextRange: jest.Mock;
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

describe('useStackDeepLink with several stacks in a panel', () => {
  it("answers only when its tab is the panel's active one", async () => {
    const front = controllerFor('front');
    const translation = controllerFor('translation');
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'p-1' },
    };

    renderHook(() => useStackDeepLink(front.controller, 'main'));
    renderHook(() => useStackDeepLink(translation.controller, 'main'));

    await waitFor(() => expect(translation.revealed).toEqual(['p-1']));
    expect(front.revealed).toEqual([]);
  });

  it('answers for Compare, which draws the translation stack', async () => {
    const { controller, revealed } = controllerFor('translation');
    mockNavigation.panels = {
      main: { open: true, tab: 'compare', hash: 'p-1' },
    };

    renderHook(() => useStackDeepLink(controller, 'main'));

    await waitFor(() => expect(revealed).toEqual(['p-1']));
  });

  it('keeps the hash when the passage is not found', async () => {
    const { controller } = controllerFor('translation');
    (controller.revealPassage as jest.Mock).mockResolvedValue(false);
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'missing' },
    };

    renderHook(() => useStackDeepLink(controller, 'main'));

    await waitFor(() =>
      expect(controller.revealPassage).toHaveBeenCalledWith('missing'),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigation.updatePanel).not.toHaveBeenCalled();
  });
});

describe('useStackDeepLink highlight', () => {
  // The window is still moving right after a reveal, so the row's content can
  // be replaced (released, then hydrated again) after the first paint.
  it('repaints when the row it highlighted is redrawn', async () => {
    const { controller } = controllerFor('translation');
    const row = document.createElement('div');
    row.id = 'p-1';
    row.innerHTML = '<div class="passage is-editable"><p>first</p></div>';
    document.body.append(row);
    mockNavigation.highlight = { start: 0, end: 3 };
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'p-1' },
    };
    libUtils.highlightTextRange.mockClear();

    renderHook(() => useStackDeepLink(controller, 'main'));
    await waitFor(() =>
      expect(libUtils.highlightTextRange).toHaveBeenCalledTimes(1),
    );

    const content = row.querySelector('.passage');
    if (content) content.innerHTML = '<p>again</p>';
    await waitFor(() =>
      expect(libUtils.highlightTextRange).toHaveBeenCalledTimes(2),
    );
    row.remove();
  });

  // A long work can redraw the row itself, not just its content, while the
  // window around a revealed passage settles.
  it('repaints into a row that replaced the one it highlighted', async () => {
    const { controller } = controllerFor('translation');
    const host = document.createElement('div');
    const row = () => {
      const el = document.createElement('div');
      el.id = 'p-2';
      el.innerHTML = '<div class="passage is-editable"><p>text</p></div>';
      return el;
    };
    const first = row();
    host.append(first);
    document.body.append(host);
    mockNavigation.highlight = { start: 0, end: 3 };
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'p-2' },
    };
    libUtils.highlightTextRange.mockClear();

    renderHook(() => useStackDeepLink(controller, 'main'));
    await waitFor(() =>
      expect(libUtils.highlightTextRange).toHaveBeenCalledTimes(1),
    );

    const second = row();
    first.replaceWith(second);
    // By identity: the two rows' markup is the same.
    await waitFor(() =>
      expect(libUtils.highlightTextRange.mock.lastCall?.[0].container).toBe(
        second.querySelector('.passage'),
      ),
    );
    host.remove();
  });

  // The URL carries one range; a link can still name a passage in each panel.
  it("paints the range on the main panel's passage when both panels have one", async () => {
    const rows = ['m-1', 'n-1'].map((id) => {
      const el = document.createElement('div');
      el.id = id;
      el.innerHTML = '<div class="passage is-editable"><p>text</p></div>';
      document.body.append(el);
      return el;
    });
    mockNavigation.highlight = { start: 0, end: 3 };
    mockNavigation.panels = {
      main: { open: true, tab: 'translation', hash: 'm-1' },
      right: { open: true, tab: 'endnotes', hash: 'n-1' },
    };
    libUtils.highlightTextRange.mockClear();
    // The notes stack answers last, after the main one has painted.
    let revealNotes: (found: boolean) => void = () => undefined;
    const notes = {
      getTab: () => 'endnotes',
      revealPassage: jest.fn(
        () => new Promise<boolean>((resolve) => (revealNotes = resolve)),
      ),
    } as unknown as PassageStackController;
    const { controller: main } = controllerFor('translation');

    renderHook(() => useStackDeepLink(notes, 'right'));
    renderHook(() => useStackDeepLink(main, 'main'));
    await waitFor(() =>
      expect(libUtils.highlightTextRange).toHaveBeenCalledTimes(1),
    );
    revealNotes(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(libUtils.highlightTextRange).toHaveBeenCalledTimes(1);
    expect(libUtils.highlightTextRange.mock.lastCall?.[0].container).toBe(
      rows[0].querySelector('.passage'),
    );
    rows.forEach((row) => row.remove());
  });
});
