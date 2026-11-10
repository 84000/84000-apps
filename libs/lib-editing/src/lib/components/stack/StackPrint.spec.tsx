import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StackPrint } from './StackPrint';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getWorkGlossaryTerms: jest.fn(),
}));
jest.mock('../shared/NavigationContext', () => ({
  useNavigation: () => ({
    uuid: 'work-1',
    toh: 'toh8',
    imprint: { mainTitles: { en: 'The Work' } },
  }),
}));
jest.mock('../shared/glossary/GlossaryInstanceBody', () => ({
  GlossaryInstanceBody: ({
    instance,
    showPassages,
  }: {
    instance: { names: { english: string } };
    showPassages?: boolean;
  }) => (
    <span>
      {instance.names.english}
      {showPassages && <button>Passages ›</button>}
    </span>
  ),
}));
jest.mock('./stack-work-context', () => ({ useStackWork: jest.fn() }));
jest.mock('./stack-print', () => ({ readStackForPrint: jest.fn() }));

const { getWorkGlossaryTerms } = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as { getWorkGlossaryTerms: jest.Mock };
const { useStackWork } = jest.requireMock('./stack-work-context') as {
  useStackWork: jest.Mock;
};
const { readStackForPrint } = jest.requireMock('./stack-print') as {
  readStackForPrint: jest.Mock;
};

/** A view whose one row reads `text`. */
const view = (tab: string, text: string) => ({
  getTab: () => tab,
  setActiveToh: jest.fn(),
  hasEarlierPassages: () => false,
  rowStyle: () => ({}),
  rows: [
    {
      meta: { uuid: `${tab}-1`, label: '1', type: tab },
      html: `<p>${text}</p>`,
    },
  ],
});

const reader = (tabs: Record<string, ReturnType<typeof view>>) => ({
  readOnly: true,
  controllerFor: (tab: string) => tabs[tab] ?? null,
});

const glossaryPage = (english: string[], more = false) => ({
  terms: english.map((name, i) => ({
    uuid: `g-${name}`,
    termNumber: i + 1,
    names: { english: name },
  })),
  hasMoreAfter: more,
  nextCursor: more ? 'next' : undefined,
  hasMoreBefore: false,
  totalCount: english.length,
});

const mount = () =>
  render(
    <StackPrint>
      <span>reader</span>
    </StackPrint>,
  );

/** Presses Cmd+P, and lets the reads it starts settle. */
const pressPrint = () =>
  act(async () => {
    fireEvent.keyDown(window, { key: 'p', metaKey: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

let print: jest.SpyInstance;

beforeEach(() => {
  print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
  readStackForPrint.mockImplementation(async (controller) => controller.rows);
  getWorkGlossaryTerms.mockResolvedValue(glossaryPage(['karma']));
});

afterEach(() => {
  print.mockRestore();
  jest.clearAllMocks();
});

describe('StackPrint', () => {
  it('draws only its children outside a stack reader', () => {
    useStackWork.mockReturnValue(null);
    render(
      <StackPrint>
        <span>child</span>
      </StackPrint>,
    );

    expect(screen.getByText('child')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      metaKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves the print shortcut alone under an editing stack', () => {
    useStackWork.mockReturnValue({ ...reader({}), readOnly: false });
    mount();

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      metaKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('draws no Print control in a stack reader', () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    mount();

    expect(screen.getByText('reader')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/print/i)).toBeNull();
  });

  it('prints the main text, the back matter and the glossary, in order', async () => {
    const front = view('front', 'front text');
    const notes = view('endnotes', 'note text');
    const abbreviations = view('abbreviations', 'abbr text');
    const bibliography = view('bibliography', 'biblio text');
    const translation = view('translation', 'body text');
    useStackWork.mockReturnValue(
      reader({
        front,
        translation,
        abbreviations,
        endnotes: notes,
        bibliography,
      }),
    );
    let printed = '';
    print.mockImplementation(() => {
      printed = document.querySelector('[data-stack-print]')?.textContent ?? '';
    });
    mount();

    await pressPrint();

    expect(print).toHaveBeenCalledTimes(1);
    expect(front.setActiveToh).toHaveBeenCalledWith('toh8');
    // Open until the print dialog closes, which some browsers don't wait for.
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'p', metaKey: true });
    });
    expect(print).toHaveBeenCalledTimes(1);
    const order = [
      'The Work',
      'front text',
      'body text',
      'abbr text',
      'note text',
      'biblio text',
      'Glossary',
      'karma',
    ];
    const at = order.map((text) => printed.indexOf(text));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);

    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(document.querySelector('[data-stack-print]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prints the glossary without a Passages link', async () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    let printed = '';
    print.mockImplementation(() => {
      printed = document.querySelector('[data-stack-print]')?.textContent ?? '';
    });
    mount();

    await pressPrint();

    expect(print).toHaveBeenCalledTimes(1);
    expect(printed).toContain('karma');
    expect(printed).not.toContain('Passages');
  });

  it('keeps a session cancelled and started again cancellable', async () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    const pending: (() => void)[] = [];
    readStackForPrint.mockImplementation(
      (controller) =>
        new Promise((resolve) => pending.push(() => resolve(controller.rows))),
    );
    mount();

    await pressPrint();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await pressPrint();
    // The first session's read ends after the second has started.
    await act(async () => pending[0]());
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => pending[1]());

    expect(print).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reads every glossary page', async () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    getWorkGlossaryTerms
      .mockResolvedValueOnce(glossaryPage(['karma'], true))
      .mockResolvedValueOnce(glossaryPage(['dharma']));
    let printed = '';
    print.mockImplementation(() => {
      printed = document.querySelector('[data-stack-print]')?.textContent ?? '';
    });
    mount();

    await pressPrint();

    expect(getWorkGlossaryTerms).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'next' }),
    );
    expect(printed).toContain('karma');
    expect(printed).toContain('dharma');
  });

  it('shows progress, and prints nothing when cancelled', async () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    let finish: (rows: null) => void = () => undefined;
    readStackForPrint.mockImplementation(
      (_controller, { onProgress, signal }) => {
        onProgress({ loaded: 3, total: 10 });
        return new Promise((resolve) => {
          finish = resolve;
          signal.addEventListener('abort', () => resolve(null));
        });
      },
    );
    mount();

    await pressPrint();

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe('10');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => finish(null));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector('[data-stack-print]')).toBeNull();
  });

  it('says so, and prints nothing, when the text cannot load', async () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    readStackForPrint.mockResolvedValue(null);
    mount();

    await pressPrint();

    expect(screen.getByRole('dialog').textContent).toMatch(/could not load/i);
    expect(print).not.toHaveBeenCalled();
  });

  it('takes over the print shortcut in a stack reader', async () => {
    useStackWork.mockReturnValue(
      reader({ translation: view('translation', 'body') }),
    );
    mount();

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      cancelable: true,
    });
    await act(async () => {
      fireEvent(window, event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(print).toHaveBeenCalledTimes(1);
  });
});
