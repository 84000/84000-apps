import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  GlossaryCopySource,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import { GlossaryCopyDialog } from './GlossaryCopyDialog';
import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSearch = jest.fn();
const mockOfAuthority = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  searchGlossaryEntriesToCopy: (args: unknown) => mockSearch(args),
  getGlossaryEntriesOfAuthority: (args: unknown) => mockOfAuthority(args),
}));

const HERE = 'w-here';

const entry = (
  uuid: string,
  workUuid: string,
  english: string,
  definition = `<p>${english} is defined at some length here.</p>`,
): GlossaryEntry => ({
  uuid,
  workUuid,
  authorityUuid: 'a1',
  definition,
  definitionRend: null,
  glossMode: 'match',
  names: [
    {
      glossaryUuid: uuid,
      nameUuid: `n-${uuid}`,
      nameAuthorityUuid: 'a1',
      language: 'en',
      content: english,
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
    {
      glossaryUuid: `r-${uuid}`,
      nameUuid: `nb-${uuid}`,
      nameAuthorityUuid: 'a1',
      language: 'Bo-Ltn',
      content: 'pad+ma',
      contentTransformed: 'པདྨ',
      termType: null,
      attestation: null,
    },
  ],
});

const SOURCE: GlossaryCopySource = {
  entry: entry('s1', 'w-there', 'Lotus', `<p>${'A flower. '.repeat(40)}</p>`),
  label: 'g.12',
  work: { uuid: 'w-there', toh: 'toh8', title: 'The Hundred Thousand' },
  headword: 'padma',
  headwordLanguage: 'Sa-Ltn',
};

const controllerWith = (copy = jest.fn()) =>
  ({
    getGlossary: () => ({ work: { workUuid: HERE } }),
    getMeta: (uuid: string) =>
      uuid === 'mine' ? { uuid, label: 'g.4', type: 'glossary' } : null,
    getGlossaryEntry: () => null,
    isReadOnly: () => false,
    copyGlossaryEntry: copy,
  }) as unknown as StackController;

const typeQuery = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Search other works'), {
    target: { value: text },
  });
  // Past the pause the search waits for, until it has answered.
  await waitFor(() => expect(screen.queryByText('Searching…')).toBeNull());
  await waitFor(() => expect(mockSearch).toHaveBeenCalled());
  await act(async () => undefined);
};

const choose = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Lotus/ }));
  });
};

beforeEach(() => {
  mockSearch.mockReset().mockResolvedValue([SOURCE]);
  mockOfAuthority.mockReset().mockResolvedValue([]);
});

describe('GlossaryCopyDialog', () => {
  it("searches other works and shows each result's work, names, definition and headword", async () => {
    const copy = jest.fn();
    render(
      <GlossaryCopyDialog
        controller={controllerWith(copy)}
        open
        onOpenChange={() => undefined}
      />,
    );
    await typeQuery('lotus');

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: HERE, query: 'lotus' }),
    );
    const result = screen.getByRole('button', { name: /Lotus/ });
    expect(result.textContent).toContain('Toh 8');
    expect(result.textContent).toContain('The Hundred Thousand');
    expect(result.textContent).toContain('g.12');
    expect(result.textContent).toContain('པདྨ');
    expect(result.textContent).toContain('pad+ma');
    expect(result.textContent).toContain('Authority: padma');
    expect(result.textContent).toMatch(/A flower\. .*…/);
    expect(result.textContent?.length).toBeLessThan(400);
    expect(copy).not.toHaveBeenCalled();
  });

  it('says so when nothing matches', async () => {
    mockSearch.mockResolvedValue([]);
    render(
      <GlossaryCopyDialog
        controller={controllerWith()}
        open
        onOpenChange={() => undefined}
      />,
    );
    await typeQuery('zzz');
    expect(screen.getByText(/No entry in another work matches/)).toBeTruthy();
  });

  it('says so when the search fails', async () => {
    mockSearch.mockResolvedValue(null);
    render(
      <GlossaryCopyDialog
        controller={controllerWith()}
        open
        onOpenChange={() => undefined}
      />,
    );
    await typeQuery('lotus');
    expect(screen.getByRole('alert').textContent).toContain('could not be run');
  });

  it('copies the chosen entry and closes', async () => {
    const copy = jest.fn().mockResolvedValue({ copied: true, entry: {} });
    const onOpenChange = jest.fn();
    render(
      <GlossaryCopyDialog
        controller={controllerWith(copy)}
        open
        onOpenChange={onOpenChange}
      />,
    );
    await typeQuery('lotus');
    await choose();

    expect(mockOfAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: HERE, authorityUuid: 'a1' }),
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.body.textContent).not.toMatch(/already/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(copy).toHaveBeenCalledWith(SOURCE.entry, expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the entry this work already has for the authority, and still copies', async () => {
    mockOfAuthority.mockResolvedValue([entry('mine', HERE, 'Lotus flower')]);
    const copy = jest.fn().mockResolvedValue({ copied: true, entry: {} });
    render(
      <GlossaryCopyDialog
        controller={controllerWith(copy)}
        open
        onOpenChange={() => undefined}
      />,
    );
    await typeQuery('lotus');
    await choose();

    const already = screen.getByRole('status');
    expect(already.textContent).toContain('already has an entry');
    expect(already.textContent).toContain('g.4');
    expect(already.textContent).toContain('Lotus flower');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy anyway' }));
    });
    expect(copy).toHaveBeenCalled();
  });

  it('keeps the dialog open with the reason when the copy is refused', async () => {
    const copy = jest
      .fn()
      .mockResolvedValue({ copied: false, error: 'Permission denied' });
    const onOpenChange = jest.fn();
    render(
      <GlossaryCopyDialog
        controller={controllerWith(copy)}
        open
        onOpenChange={onOpenChange}
      />,
    );
    await typeQuery('lotus');
    await choose();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByRole('alert').textContent).toContain(
      'Permission denied',
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("never shows an earlier query's late answer for a later query", async () => {
    const answers: Record<string, (results: GlossaryCopySource[]) => void> = {};
    mockSearch.mockImplementation(
      ({ query }: { query: string }) =>
        new Promise((resolve) => {
          answers[query] = resolve;
        }),
    );
    render(
      <GlossaryCopyDialog
        controller={controllerWith()}
        open
        onOpenChange={() => undefined}
      />,
    );
    const box = screen.getByLabelText('Search other works');
    fireEvent.change(box, { target: { value: 'lot' } });
    await waitFor(() => expect(answers['lot']).toBeDefined());
    fireEvent.change(box, { target: { value: 'lotus' } });
    await waitFor(() => expect(answers['lotus']).toBeDefined());

    await act(async () => answers['lotus']([SOURCE]));
    await act(async () => answers['lot']([]));

    expect(screen.getByRole('button', { name: /Lotus/ })).toBeTruthy();
    expect(screen.queryByText(/No entry in another work matches/)).toBeNull();
  });

  it("keeps Copy off until this work's entries for the authority are read", async () => {
    let answer: (entries: GlossaryEntry[]) => void = () => undefined;
    mockOfAuthority.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(
      <GlossaryCopyDialog
        controller={controllerWith()}
        open
        onOpenChange={() => undefined}
      />,
    );
    await typeQuery('lotus');
    await choose();

    const copy = screen.getByRole('button', { name: 'Copy' });
    expect(copy.hasAttribute('disabled')).toBe(true);
    await act(async () => answer([]));
    expect(copy.hasAttribute('disabled')).toBe(false);
  });

  it('goes back to the results without copying', async () => {
    const copy = jest.fn();
    render(
      <GlossaryCopyDialog
        controller={controllerWith(copy)}
        open
        onOpenChange={() => undefined}
      />,
    );
    await typeQuery('lotus');
    await choose();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    });
    expect(screen.getByLabelText('Search other works')).toBeTruthy();
    expect(copy).not.toHaveBeenCalled();
  });
});

describe('GlossaryCopyDialog search timing', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const renderOpen = (open = true) =>
    render(
      <GlossaryCopyDialog
        controller={controllerWith()}
        open={open}
        onOpenChange={() => undefined}
      />,
    );
  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText('Search other works'), {
      target: { value },
    });

  it('draws nothing while closed', () => {
    renderOpen(false);
    expect(screen.queryByLabelText('Search other works')).toBeNull();
  });

  it('searches once typing pauses, for this work', async () => {
    renderOpen();
    type('lotus');
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockSearch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: HERE, query: 'lotus' }),
    );
  });

  it('searches once for a run of keystrokes, not once for each', async () => {
    renderOpen();
    for (const value of ['l', 'lo', 'lot', 'lotu', 'lotus']) {
      type(value);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(mockSearch.mock.calls.map(([args]) => args.query)).toEqual([
      'lotus',
    ]);
  });
});

describe('GlossaryRowMenu: Copy from Another Work', () => {
  it('opens the copy dialog from the label menu', async () => {
    const controller = {
      ...controllerWith(),
      getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
    } as unknown as StackController;
    const target = {
      uuid: 'e1',
      rect: { top: 0, left: 0, width: 1, height: 1 },
    };
    const view = render(
      <GlossaryRowMenu
        controller={controller}
        target={target}
        onClose={() => undefined}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Copy from Another Work'));
    });
    view.rerender(
      <GlossaryRowMenu
        controller={controller}
        target={null}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('dialog').textContent).toContain(
      'Copy from Another Work',
    );
    expect(screen.getByLabelText('Search other works')).toBeTruthy();
  });

  it('is not offered where the stack is read-only', () => {
    const controller = {
      ...controllerWith(),
      getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
      isReadOnly: () => true,
    } as unknown as StackController;
    render(
      <GlossaryRowMenu
        controller={controller}
        target={{ uuid: 'e1', rect: { top: 0, left: 0, width: 1, height: 1 } }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Copy Link')).toBeTruthy();
    expect(screen.queryByText('Copy from Another Work')).toBeNull();
  });
});
