import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  GlossaryAuthority,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import type { StackController } from './StackController';
import { openGlossaryEntryPanel } from './glossary-entry-panel';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSave = jest.fn();
const mockRead = jest.fn();
const mockAuthorities = jest.fn();
const mockSearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  saveGlossaryEntry: (args: unknown) => mockSave(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
  getGlossaryAuthorities: (args: unknown) => mockAuthorities(args),
  searchGlossaryAuthorities: (args: unknown) => mockSearch(args),
}));

const authority = (uuid: string, headword: string): GlossaryAuthority => ({
  uuid,
  headword,
  headwordLanguage: 'Sa-Ltn',
  definition: `<p>The standard ${headword}.</p>`,
  names: [],
});

const AUTHORITIES: Record<string, GlossaryAuthority> = {
  a1: authority('a1', 'Indra'),
  a2: authority('a2', 'Śakra'),
};

const entry = (
  uuid: string,
  overrides: Partial<GlossaryEntry> = {},
): GlossaryEntry => ({
  uuid,
  workUuid: 'w1',
  authorityUuid: 'a1',
  definition: '<p>The king of the gods.</p>',
  definitionRend: null,
  glossMode: 'match',
  names: [
    {
      glossaryUuid: uuid,
      nameUuid: `n-${uuid}`,
      nameAuthorityUuid: 'a1',
      language: 'en',
      content: uuid === 'e1' ? 'Indra' : 'Brahmā',
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
  ],
  ...overrides,
});

/** A controller holding read entries, as the stack does for its rows. */
const fakeController = ({
  readOnly = false,
  entries = [entry('e1'), entry('e2')],
} = {}) => {
  const held = new Map(entries.map((e) => [e.uuid, e]));
  let focused: string | null = null;
  let version = 0;
  const listeners = new Set<() => void>();
  const bump = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  const controller = {
    getFocusedUuid: () => focused,
    getGlossaryEntry: (uuid: string) => held.get(uuid) ?? null,
    isReadOnly: () => readOnly,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    settleGlossaryEntry: jest.fn((uuid: string, next: GlossaryEntry) => {
      held.set(uuid, next);
      bump();
    }),
  };
  const focus = (uuid: string) => {
    focused = uuid;
    bump();
  };
  return {
    controller: controller as unknown as StackController,
    settle: controller.settleGlossaryEntry,
    held,
    focus,
  };
};

const setup = (options?: Parameters<typeof fakeController>[0]) => {
  const fake = fakeController(options);
  render(<GlossaryEntryPanel controller={fake.controller} />);
  return fake;
};

const open = async (controller: StackController, uuid = 'e1') => {
  await act(async () => {
    openGlossaryEntryPanel(controller, uuid);
  });
};

const panel = () =>
  document.querySelector('[data-glossary-entry-panel]') as HTMLElement | null;

const radio = (label: string) =>
  screen.getByRole('radio', {
    name: new RegExp(`^${label}`),
  }) as HTMLInputElement;

beforeEach(() => {
  mockSave.mockReset();
  mockRead.mockReset();
  mockSearch.mockReset();
  mockAuthorities.mockReset();
  mockAuthorities.mockImplementation(async ({ uuids }: { uuids: string[] }) =>
    uuids.map((uuid) => AUTHORITIES[uuid]).filter(Boolean),
  );
});

describe('GlossaryEntryPanel', () => {
  it('is closed until an entry is opened', async () => {
    const { controller } = setup();
    expect(panel()).toBeNull();
    await open(controller);
    expect(panel()).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Indra' })).toBeTruthy();
  });

  it('switches to another row selected while it is open', async () => {
    const { controller, focus } = setup();
    await open(controller);
    await act(async () => focus('e2'));
    expect(screen.getByRole('heading', { name: 'Brahmā' })).toBeTruthy();
  });

  it('shows the linked authority with its headword, language and standard definition', async () => {
    const { controller } = setup();
    await open(controller);
    const shown = document.querySelector(
      '[data-glossary-entry-authority]',
    ) as HTMLElement;
    expect(shown.textContent).toContain('Indra');
    expect(shown.textContent).toContain('Sanskrit');
    expect(
      document.querySelector('[data-glossary-entry-standard]')?.textContent,
    ).toContain('The standard Indra.');
  });

  it('offers five definition relations with explanations, none chosen for null', async () => {
    const { controller } = setup();
    await open(controller);
    const group = document.querySelector(
      '[data-glossary-entry-choice="definitionRend"]',
    ) as HTMLElement;
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(5);
    expect(radio('None').checked).toBe(true);
    expect(group.textContent).toContain('readers see this entry’s definition');
  });

  it('previews what readers see for the chosen relation', async () => {
    const { controller } = setup({
      entries: [entry('e1', { definitionRend: 'appendWithStandard' })],
    });
    await open(controller);
    const preview = () =>
      document.querySelector('[data-glossary-entry-preview]')?.textContent;
    expect(preview()).toContain('The king of the gods.');
    expect(preview()).toContain('The standard Indra.');
  });

  it('saves a relation on its own and settles the saved entry', async () => {
    const { controller, settle } = setup();
    const saved = entry('e1', { definitionRend: 'overrideWithStandard' });
    mockSave.mockResolvedValue({ success: true, entries: [saved] });
    await open(controller);
    await act(async () => {
      fireEvent.click(radio('Override'));
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].after).toEqual({
      definitionRend: 'overrideWithStandard',
    });
    expect(settle).toHaveBeenCalledWith('e1', saved);
    expect(radio('Override').checked).toBe(true);
    expect(
      document.querySelector('[data-glossary-entry-preview]')?.textContent,
    ).toBe('The standard Indra.');
  });

  it('saves none as null', async () => {
    const { controller } = setup({
      entries: [entry('e1', { definitionRend: 'appendWithStandard' })],
    });
    mockSave.mockResolvedValue({ success: true, entries: [entry('e1')] });
    await open(controller);
    await act(async () => {
      fireEvent.click(radio('None'));
    });
    expect(mockSave.mock.calls[0][0].after).toEqual({ definitionRend: null });
  });

  it('offers match and marked, showing match for an entry with no mode', async () => {
    const { controller } = setup();
    mockSave.mockResolvedValue({
      success: true,
      entries: [entry('e1', { glossMode: 'marked' })],
    });
    await open(controller);
    expect(radio('Match').checked).toBe(true);
    expect(radio('Marked').checked).toBe(false);
    await act(async () => {
      fireEvent.click(radio('Marked'));
    });
    expect(mockSave.mock.calls[0][0].after).toEqual({ glossMode: 'marked' });
  });

  it('saves nothing when opened and closed without a change', async () => {
    const { controller } = setup();
    await open(controller);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(panel()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('keeps the editor’s value on a conflict, and takes theirs when asked', async () => {
    const { controller, settle } = setup();
    const theirs = entry('e1', { definitionRend: 'prependWithStandard' });
    mockSave.mockResolvedValue({
      success: false,
      reason: 'stale',
      error: 'changed',
    });
    mockRead.mockResolvedValue({ status: 'found', entry: theirs });
    await open(controller);
    await act(async () => {
      fireEvent.click(radio('Override'));
    });
    const alert = document.querySelector(
      '[data-glossary-entry-conflict]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('changed by someone else');
    expect(alert.textContent).toContain('Prepend the standard');
    expect(radio('Override').checked).toBe(true);
    expect(settle).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use theirs' }));
    });
    expect(settle).toHaveBeenCalledWith('e1', theirs);
    expect(radio('Prepend').checked).toBe(true);
    expect(document.querySelector('[data-glossary-entry-conflict]')).toBeNull();
  });

  it('saves the editor’s value over theirs on Keep mine', async () => {
    const { controller } = setup();
    const theirs = entry('e1', { definitionRend: 'prependWithStandard' });
    const mine = entry('e1', { definitionRend: 'overrideWithStandard' });
    mockSave
      .mockResolvedValueOnce({ success: false, reason: 'stale', error: 'x' })
      .mockResolvedValueOnce({ success: true, entries: [mine] });
    mockRead.mockResolvedValue({ status: 'found', entry: theirs });
    await open(controller);
    await act(async () => {
      fireEvent.click(radio('Override'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    });
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0].before).toEqual(theirs);
    expect(mockSave.mock.calls[1][0].after).toEqual({
      definitionRend: 'overrideWithStandard',
    });
    expect(radio('Override').checked).toBe(true);
    expect(document.querySelector('[data-glossary-entry-conflict]')).toBeNull();
  });

  it('relinks to a searched authority after a confirmation naming both', async () => {
    const { controller } = setup();
    mockSearch.mockResolvedValue([{ ...AUTHORITIES.a2, matchedName: null }]);
    mockSave.mockResolvedValue({
      success: true,
      entries: [entry('e1', { authorityUuid: 'a2' })],
    });
    await open(controller);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Link another authority' }),
      );
    });
    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Search authorities'), {
      target: { value: 'sakra' },
    });
    await act(async () => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
    await act(async () => undefined);
    await act(async () => {
      fireEvent.click(screen.getByText('Śakra'));
    });
    const dialog = screen.getByRole('dialog', { name: /Link to Śakra/ });
    expect(dialog.textContent).toContain('Indra');
    expect(dialog.textContent).toContain('definition readers see may change');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    });
    expect(mockSave.mock.calls[0][0].after).toEqual({ authorityUuid: 'a2' });
    await act(async () => undefined);
    expect(
      document.querySelector('[data-glossary-entry-authority]')?.textContent,
    ).toContain('Śakra');
  });

  it('changes nothing when a relink is cancelled', async () => {
    const { controller } = setup();
    mockSearch.mockResolvedValue([{ ...AUTHORITIES.a2, matchedName: null }]);
    await open(controller);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Link another authority' }),
      );
    });
    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Search authorities'), {
      target: { value: 'sakra' },
    });
    await act(async () => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
    await act(async () => undefined);
    await act(async () => {
      fireEvent.click(screen.getByText('Śakra'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /Link to/ })).toBeNull();
  });

  it('shows values without controls when read-only', async () => {
    const { controller } = setup({
      readOnly: true,
      entries: [entry('e1', { definitionRend: 'appendWithStandard' })],
    });
    await open(controller);
    const body = panel() as HTMLElement;
    expect(body.querySelectorAll('input')).toHaveLength(0);
    expect(screen.queryByText('Link another authority')).toBeNull();
    expect(body.textContent).toContain('Append the standard');
    expect(body.textContent).toContain('Match');
    expect(body.textContent).toContain('The standard Indra.');
  });
});
