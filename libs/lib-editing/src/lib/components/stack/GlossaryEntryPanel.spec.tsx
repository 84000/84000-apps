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
  let version = 0;
  const listeners = new Set<() => void>();
  const bump = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  const controller = {
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
  return {
    controller: controller as unknown as StackController,
    settle: controller.settleGlossaryEntry,
    held,
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

const relation = () =>
  screen.getByRole('combobox', { name: 'Definition relation' });

/** Choose a definition relation through the select, by keyboard. */
const choose = async (label: string) => {
  await act(async () => {
    fireEvent.keyDown(relation(), { key: 'Enter' });
  });
  await act(async () => {
    fireEvent.keyDown(screen.getByRole('option', { name: label }), {
      key: 'Enter',
    });
  });
};

beforeAll(() => {
  // Radix Select reaches for these, which jsdom lacks.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

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

  it('shows the linked authority with its headword, language and standard definition', async () => {
    const { controller } = setup();
    await open(controller);
    const shown = document.querySelector(
      '[data-glossary-entry-authority]',
    ) as HTMLElement;
    expect(shown.textContent).toContain('Indra');
    expect(shown.textContent).toContain('Sanskrit');
    expect(shown.textContent).not.toContain('Standard definition');
    expect(
      document.querySelector('[data-glossary-entry-standard]')?.textContent,
    ).toContain('The standard Indra.');
  });

  it('offers the four definition relations, showing a stored null as custom', async () => {
    const { controller } = setup();
    await open(controller);
    expect(relation().textContent).toBe('Custom definition');
    expect(
      document.querySelector('[data-glossary-entry-rend]')?.textContent,
    ).toContain('Readers see only this entry’s definition.');
    await act(async () => {
      fireEvent.keyDown(relation(), { key: 'Enter' });
    });
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'Custom definition',
      'Use standard',
      'Append standard',
      'Prepend standard',
    ]);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('warns when the standard is used and the authority has none', async () => {
    mockAuthorities.mockResolvedValue([{ ...AUTHORITIES.a1, definition: ' ' }]);
    const { controller } = setup({
      entries: [entry('e1', { definitionRend: 'overrideWithStandard' })],
    });
    await open(controller);
    expect(
      document.querySelector('[data-glossary-entry-no-standard]')?.textContent,
    ).toContain('no standard definition');
    expect(
      document.querySelector('[data-glossary-entry-standard]')?.textContent,
    ).toBe('This authority has no standard definition.');
  });

  it('does not warn when the authority has a standard definition', async () => {
    const { controller } = setup({
      entries: [entry('e1', { definitionRend: 'overrideWithStandard' })],
    });
    await open(controller);
    expect(
      document.querySelector('[data-glossary-entry-no-standard]'),
    ).toBeNull();
  });

  it('saves a relation on its own and settles the saved entry', async () => {
    const { controller, settle } = setup();
    const saved = entry('e1', { definitionRend: 'overrideWithStandard' });
    mockSave.mockResolvedValue({ success: true, entries: [saved] });
    await open(controller);
    await choose('Use standard');
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].after).toEqual({
      definitionRend: 'overrideWithStandard',
    });
    expect(settle).toHaveBeenCalledWith('e1', saved);
    expect(relation().textContent).toBe('Use standard');
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
    await choose('Use standard');
    const alert = document.querySelector(
      '[data-glossary-entry-conflict]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('changed by someone else');
    expect(alert.textContent).toContain('Prepend standard');
    expect(relation().textContent).toBe('Use standard');
    expect(settle).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use theirs' }));
    });
    expect(settle).toHaveBeenCalledWith('e1', theirs);
    expect(relation().textContent).toBe('Prepend standard');
    expect(document.querySelector('[data-glossary-entry-conflict]')).toBeNull();
  });

  it('keeps a refused save when the panel is opened on another row and back', async () => {
    const { controller } = setup();
    mockSave.mockResolvedValue({
      success: false,
      reason: 'stale',
      error: 'changed',
    });
    mockRead.mockResolvedValue({
      status: 'found',
      entry: entry('e1', { definitionRend: 'prependWithStandard' }),
    });
    await open(controller);
    await choose('Use standard');
    await open(controller, 'e2');
    expect(document.querySelector('[data-glossary-entry-conflict]')).toBeNull();
    await open(controller, 'e1');
    expect(
      document.querySelector('[data-glossary-entry-conflict]'),
    ).toBeTruthy();
    expect(relation().textContent).toBe('Use standard');
  });

  it('sanitizes the standard definition it draws', async () => {
    mockAuthorities.mockResolvedValue([
      {
        ...AUTHORITIES.a1,
        definition:
          '<p onmouseover="alert(1)">Safe <img src=x onerror="alert(1)"></p>',
      },
    ]);
    const { controller } = setup();
    await open(controller);
    const standard = document.querySelector(
      '[data-glossary-entry-standard]',
    ) as HTMLElement;
    expect(standard.textContent).toContain('Safe');
    expect(standard.innerHTML).not.toContain('onmouseover');
    expect(standard.innerHTML).not.toContain('onerror');
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
    await choose('Use standard');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    });
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(mockSave.mock.calls[1][0].before).toEqual(theirs);
    expect(mockSave.mock.calls[1][0].after).toEqual({
      definitionRend: 'overrideWithStandard',
    });
    expect(relation().textContent).toBe('Use standard');
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
    // The confirmation is a step in the panel, not a dialog of its own.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const confirm = screen.getByRole('group', { name: 'Link to Śakra?' });
    expect(confirm.textContent).toContain('Indra');
    expect(confirm.textContent).toContain('definition readers see may change');
    expect(screen.queryByLabelText('Search authorities')).toBeNull();
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
    expect(screen.queryByRole('group', { name: /Link to/ })).toBeNull();
    expect(screen.getByLabelText('Search authorities')).toBeTruthy();
  });

  it('shows values without controls when read-only', async () => {
    const { controller } = setup({
      readOnly: true,
      entries: [entry('e1', { definitionRend: 'appendWithStandard' })],
    });
    await open(controller);
    const body = panel() as HTMLElement;
    expect(body.querySelectorAll('input')).toHaveLength(0);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Link another authority' }),
    ).toBeNull();
    expect(body.textContent).toContain('Append standard');
    expect(body.textContent).not.toContain('Matching');
    expect(body.textContent).toContain('The standard Indra.');
  });
});
