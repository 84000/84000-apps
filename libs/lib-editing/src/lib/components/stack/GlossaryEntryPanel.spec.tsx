import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
  getGlossaryEntrySharedNames: async () => new Set(),
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
  let focused: string | null = null;
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
    getFocusedUuid: () => focused,
    focusPassage: (uuid: string) => {
      focused = uuid;
      bump();
    },
    settleGlossaryEntry: jest.fn((uuid: string, next: GlossaryEntry) => {
      held.set(uuid, next);
      bump();
    }),
  };
  return {
    controller: controller as unknown as StackController,
    settle: controller.settleGlossaryEntry,
    select: controller.focusPassage,
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
    // A dialog, not a side sheet.
    expect(screen.getByRole('dialog')).toBe(panel());
  });

  it('shows the entry it was opened on, whichever row is selected after', async () => {
    const { controller, select } = setup();
    await open(controller, 'e1');
    await act(async () => {
      select('e2');
    });
    expect(screen.getByRole('heading', { name: 'Indra' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Brahmā' })).toBeNull();
    expect(panel()?.textContent).toContain('Indra');
    expect(panel()?.textContent).not.toContain('Brahmā');
  });

  it('shows the linked authority with its headword, language and standard definition', async () => {
    const { controller } = setup();
    await open(controller);
    const shown = document.querySelector(
      '[data-glossary-entry-authority]',
    ) as HTMLElement;
    expect(shown.textContent).toContain('Indra');
    expect(shown.textContent).toContain('Sanskrit');
    // The language sits below the headword.
    expect(shown.textContent?.indexOf('Sanskrit')).toBeGreaterThan(
      shown.textContent?.indexOf('Indra') as number,
    );
    expect(shown.textContent).not.toContain('Standard definition');
    // Relinking is an icon button beside the headword, with no text of its own.
    const relink = within(shown).getByRole('button', {
      name: 'Link another authority',
    });
    expect(relink.textContent).toBe('');
    expect(relink.querySelector('svg')).toBeTruthy();
    expect(relink.parentElement?.textContent).toContain('Indra');
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

  it('saves each relation as its stored value', async () => {
    const { controller } = setup();
    mockSave.mockImplementation(
      async ({
        before,
        after,
      }: {
        before: GlossaryEntry;
        after: Partial<GlossaryEntry>;
      }) => ({ success: true, entries: [{ ...before, ...after }] }),
    );
    await open(controller);
    await choose('Append standard');
    await choose('Prepend standard');
    await choose('Use standard');
    await choose('Custom definition');
    expect(mockSave.mock.calls.map(([args]) => args.after)).toEqual([
      { definitionRend: 'appendWithStandard' },
      { definitionRend: 'prependWithStandard' },
      { definitionRend: 'overrideWithStandard' },
      { definitionRend: 'incompatibleWithStandard' },
    ]);
    expect(relation().textContent).toBe('Custom definition');
  });

  it('has no matching control, radios or preview of what readers see', async () => {
    const { controller } = setup();
    await open(controller);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(panel()?.textContent).not.toContain('Matching');
    expect(panel()?.textContent).not.toContain('What readers will see');
    expect(screen.queryByText('None')).toBeNull();
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

  it('warns only once the standard is used, saying the authority has none', async () => {
    mockAuthorities.mockResolvedValue([
      { ...AUTHORITIES.a1, definition: null },
    ]);
    const { controller } = setup();
    mockSave.mockImplementation(
      async ({
        before,
        after,
      }: {
        before: GlossaryEntry;
        after: Partial<GlossaryEntry>;
      }) => ({ success: true, entries: [{ ...before, ...after }] }),
    );
    await open(controller);
    const standard = () =>
      document.querySelector('[data-glossary-entry-standard]');
    expect(standard()?.textContent).toBe(
      'This authority has no standard definition.',
    );
    expect(
      document.querySelector('[data-glossary-entry-no-standard]'),
    ).toBeNull();
    for (const other of ['Append standard', 'Prepend standard']) {
      await choose(other);
      expect(
        document.querySelector('[data-glossary-entry-no-standard]'),
      ).toBeNull();
    }
    await choose('Use standard');
    expect(
      document.querySelector('[data-glossary-entry-no-standard]'),
    ).toBeTruthy();
    expect(standard()?.textContent).toBe(
      'This authority has no standard definition.',
    );
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

  it('saves nothing when an oddly stored entry is opened and closed', async () => {
    const odd = entry('e1', {
      definition: null,
      glossMode: null as unknown as string,
    });
    odd.names = [
      { ...odd.names[0], termType: null },
      {
        ...odd.names[0],
        glossaryUuid: 'g-sa',
        nameUuid: 'n-sa',
        language: 'Sa-Ltn',
        content: 'Śakra',
        termType: 'translationAlternative',
      },
      {
        ...odd.names[0],
        glossaryUuid: 'g-ko',
        nameUuid: 'n-ko',
        language: 'Ko-Ltn',
        content: 'other',
      },
    ];
    const { controller } = setup({ entries: [odd] });
    await open(controller);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('saves each change on its own, against the entry the last save returned', async () => {
    const { controller, held } = setup({
      entries: [
        entry('e1', {
          names: [
            ...entry('e1').names,
            {
              glossaryUuid: 'g-sa',
              nameUuid: 'n-sa',
              nameAuthorityUuid: 'a1',
              language: 'Sa-Ltn',
              content: 'bodhicitta',
              contentTransformed: null,
              termType: null,
              attestation: null,
            },
          ],
        }),
      ],
    });
    let added = 0;
    mockSave.mockImplementation(
      async ({
        before,
        after,
      }: {
        before: GlossaryEntry;
        after: Partial<GlossaryEntry>;
      }) => {
        const names = after.names?.map((n) => ({
          ...n,
          glossaryUuid: n.glossaryUuid ?? `g-new-${++added}`,
          nameUuid: n.nameUuid ?? `n-new-${added}`,
          nameAuthorityUuid: n.nameAuthorityUuid ?? before.authorityUuid,
        }));
        const saved = { ...before, ...after, ...(names ? { names } : {}) };
        return { success: true, entries: [saved] };
      },
    );
    mockSearch.mockResolvedValue([{ ...AUTHORITIES.a2, matchedName: null }]);
    await open(controller);
    await choose('Append standard');
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Attestation of bodhicitta'), {
        key: 'Enter',
      });
    });
    await act(async () => {
      fireEvent.keyDown(
        screen.getByRole('option', { name: 'Attested Other' }),
        {
          key: 'Enter',
        },
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /an alternative/ }));
    });
    fireEvent.change(screen.getByLabelText(/New English alternatives name/), {
      target: { value: 'brand new' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
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
      fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    });
    await choose('Prepend standard');
    await choose('Custom definition');

    const calls = mockSave.mock.calls.map(([args]) => args);
    expect(calls.map((call) => Object.keys(call.after))).toEqual([
      ['definitionRend'],
      ['names'],
      ['names'],
      ['authorityUuid'],
      ['definitionRend'],
      ['definitionRend'],
    ]);
    for (const [i, call] of calls.entries()) {
      if (i === 0) continue;
      const previous = await mockSave.mock.results[i - 1].value;
      expect(call.before).toEqual(previous.entries[0]);
    }
    expect(document.querySelector('[data-glossary-entry-conflict]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use theirs' })).toBeNull();
    const stored = held.get('e1') as GlossaryEntry;
    expect(stored).toMatchObject({
      definitionRend: 'incompatibleWithStandard',
      authorityUuid: 'a2',
      glossMode: 'match',
    });
    expect(
      stored.names.find((n) => n.content === 'bodhicitta')?.attestation,
    ).toBe('attestedOther');
    expect(stored.names.find((n) => n.content === 'brand new')).toMatchObject({
      language: 'en',
      termType: 'translationAlternative',
    });
    expect(stored.definition).toBe('<p>The king of the gods.</p>');
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
    expect(confirm.textContent).toContain('Śakra');
    // A custom definition doesn't draw on the authority, so nothing changes.
    expect(confirm.textContent).not.toContain('definition readers see');
    // The search stays, hidden, so cancelling returns to its results.
    expect(
      screen.getByLabelText('Search authorities').closest('[hidden]'),
    ).not.toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
    expect(
      within(confirm)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Link', 'Cancel']);
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Link' }));
    });
    expect(mockSave.mock.calls[0][0].after).toEqual({ authorityUuid: 'a2' });
    await act(async () => undefined);
    expect(
      document.querySelector('[data-glossary-entry-authority]')?.textContent,
    ).toContain('Śakra');
    expect(screen.queryByRole('group', { name: /Link to/ })).toBeNull();
    expect(screen.queryByLabelText('Search authorities')).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('warns that the definition changes when it draws on the standard', async () => {
    const { controller } = setup({
      entries: [entry('e1', { definitionRend: 'appendWithStandard' })],
    });
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
    expect(
      screen.getByRole('group', { name: 'Link to Śakra?' }).textContent,
    ).toContain('definition readers see will change');
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
    const confirm = screen.getByRole('group', { name: 'Link to Śakra?' });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    });
    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /Link to/ })).toBeNull();
    expect(screen.getByLabelText('Search authorities')).toBeTruthy();
    expect(
      document.querySelector('[data-glossary-entry-authority]')?.textContent,
    ).toContain('Indra');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
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
