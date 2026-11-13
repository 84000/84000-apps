import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  GlossaryAuthorityMatch,
  GlossaryEntry,
  GlossaryEntryMatch,
} from '@eightyfourthousand/data-access';

import { GlossaryEntryForm } from './GlossaryEntryForm';

// The stack's barrels reach `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockClient = { client: 'browser' };
const mockCreate = jest.fn();
const mockMatches = jest.fn();
const mockSearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => mockClient,
  createGlossaryEntry: (args: unknown) => mockCreate(args),
  findGlossaryEntryMatches: (args: unknown) => mockMatches(args),
  searchGlossaryAuthorities: (args: unknown) => mockSearch(args),
}));

const WORK = 'work-1';

const AUTHORITY: GlossaryAuthorityMatch = {
  uuid: 'auth-1',
  headword: 'Indra',
  headwordLanguage: 'Sa-Ltn',
  definition: null,
  names: [],
  matchedName: null,
};

const ENTRY = {
  uuid: 'entry-new',
  workUuid: WORK,
  authorityUuid: 'auth-1',
  definition: null,
  definitionRend: null,
  glossMode: 'match',
  names: [],
} as GlossaryEntry;

const SUCCESS = {
  success: true,
  dryRun: false,
  entries: [ENTRY],
  deleted: [],
  changes: {},
};

const FAILURE = {
  success: false,
  reason: 'failed',
  error: 'The database is unavailable.',
  outcomeUnknown: false,
};

const DUPLICATES: GlossaryEntryMatch[] = [
  {
    uuid: 'dup-name',
    label: 'g.3',
    english: 'Lord of Gods',
    authorityUuid: 'other-auth',
    sameName: true,
    sameAuthority: false,
  },
  {
    uuid: 'dup-auth',
    label: 'g.12',
    english: 'Śakra',
    authorityUuid: 'auth-1',
    sameName: false,
    sameAuthority: true,
  },
];

/** Waits long enough for the debounced searches on a loaded machine. */
const SLOW = { timeout: 5000 };

const setup = (
  props: Partial<React.ComponentProps<typeof GlossaryEntryForm>> = {},
) => {
  const onCreated = jest.fn();
  const onCancel = jest.fn();
  render(
    <GlossaryEntryForm
      workUuid={WORK}
      onCreated={onCreated}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onCreated, onCancel };
};

const englishInput = () =>
  screen.getByLabelText('English name') as HTMLInputElement;
const createButton = () =>
  screen.getByRole('button', { name: 'Create entry' }) as HTMLButtonElement;

const setName = (value: string) =>
  fireEvent.change(englishInput(), { target: { value } });

/** Search for an authority and pick the one result. */
const pickAuthority = async () => {
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Indra' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Indra/ }, SLOW));
  await screen.findByRole('button', { name: 'Change' }, SLOW);
};

/** Silences the errors a failing create logs, for the rest of one test. */
let silenced: jest.SpyInstance | undefined;
const quiet = () => {
  silenced = jest.spyOn(console, 'error').mockImplementation(() => undefined);
};

afterEach(() => {
  silenced?.mockRestore();
  silenced = undefined;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch.mockResolvedValue([AUTHORITY]);
  mockMatches.mockResolvedValue([]);
  mockCreate.mockResolvedValue(SUCCESS);
});

describe('GlossaryEntryForm', () => {
  it('offers no way to create an authority, even when none matches', async () => {
    setup({ initialEnglish: 'Indra' });
    mockSearch.mockResolvedValue([]);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'zzz' },
    });
    await screen.findByText(/No authority matches/, undefined, SLOW);

    expect(
      screen.queryByRole('button', { name: /(create|add|new)\b.*authorit/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: /(create|add|new)\b.*authorit/i }),
    ).toBeNull();
    expect(
      screen
        .getAllByRole('button')
        .filter((b) => /create/i.test(b.textContent ?? ''))
        .map((b) => b.textContent),
    ).toEqual(['Create entry']);
  });

  it('creates only with a name and an authority', async () => {
    setup();
    expect(englishInput().value).toBe('');
    expect(createButton().disabled).toBe(true);
    setName('Indra');
    expect(createButton().disabled).toBe(true);
    fireEvent.click(createButton());
    expect(mockCreate).not.toHaveBeenCalled();

    setName('');
    await pickAuthority();
    expect(createButton().disabled).toBe(true);
    setName('   ');
    expect(createButton().disabled).toBe(true);
    setName('Indra');
    expect(createButton().disabled).toBe(false);

    // Change goes back to the search, and the authority must be picked again.
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('searchbox')).toBeTruthy();
    expect(createButton().disabled).toBe(true);
  });

  it('creates the entry with the English name as edited and hands it on once saved', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockCreate.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { onCreated } = setup({ initialEnglish: 'Indra' });
    await pickAuthority();
    setName('Lord Indra');
    fireEvent.change(screen.getByLabelText('Definition'), {
      target: { value: '   ' },
    });
    fireEvent.click(createButton());

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const args = mockCreate.mock.calls[0][0];
    expect(args.client).toBe(mockClient);
    expect(args.workUuid).toBe(WORK);
    expect(args.entry.authorityUuid).toBe('auth-1');
    expect(args.entry.definition).toBeNull();
    expect(args.entry.names).toEqual([
      {
        language: 'en',
        content: 'Lord Indra',
        contentTransformed: null,
        termType: 'translationMain',
        attestation: null,
      },
    ]);
    expect(onCreated).not.toHaveBeenCalled();

    finish(SUCCESS);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
  });

  it('stores the definition as escaped paragraphs and line breaks', async () => {
    setup({ initialEnglish: 'Indra' });
    await pickAuthority();
    fireEvent.change(screen.getByLabelText('Definition'), {
      target: { value: 'King of <b>gods</b>\nand men.\n\n  Second.  ' },
    });
    fireEvent.click(createButton());

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0].entry.definition).toBe(
      '<p>King of &lt;b&gt;gods&lt;/b&gt;<br>and men.</p><p>Second.</p>',
    );
  });

  it('shows why an entry was not created, and keeps the form to try again', async () => {
    mockCreate.mockResolvedValue(FAILURE);
    const { onCreated } = setup({ initialEnglish: 'Indra' });
    await pickAuthority();
    fireEvent.click(createButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The database is unavailable.');
    expect(onCreated).not.toHaveBeenCalled();
    expect(englishInput().value).toBe('Indra');
    expect(createButton().disabled).toBe(false);

    quiet();
    mockCreate.mockRejectedValue(new Error('offline'));
    fireEvent.click(createButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Something went wrong.',
      ),
    );
    expect(onCreated).not.toHaveBeenCalled();

    mockCreate.mockResolvedValue(SUCCESS);
    fireEvent.click(createButton());
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
  });

  it('does not offer to create again when what follows the create fails', async () => {
    quiet();
    setup({
      initialEnglish: 'Indra',
      onCreated: jest.fn().mockRejectedValue(new Error('not shown')),
    });
    await pickAuthority();
    fireEvent.click(createButton());

    await screen.findByText(
      'The entry was created, but could not be shown here.',
    );
    expect(createButton().disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  describe('possible duplicates', () => {
    it('lists the entries with the same name or authority, and still creates', async () => {
      mockMatches.mockResolvedValue(DUPLICATES);
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();

      expect(
        await screen.findByText('Possible duplicates', undefined, SLOW),
      ).toBeTruthy();
      expect(mockMatches).toHaveBeenCalledWith(
        expect.objectContaining({
          client: mockClient,
          workUuid: WORK,
          english: 'Indra',
          authorityUuid: 'auth-1',
        }),
      );
      expect(screen.getByText('g.3')).toBeTruthy();
      expect(screen.getByText('Lord of Gods')).toBeTruthy();
      expect(screen.getByText(/same name/i)).toBeTruthy();
      expect(screen.getByText('g.12')).toBeTruthy();
      expect(screen.getByText('Śakra')).toBeTruthy();
      expect(screen.getByText(/same authority/i)).toBeTruthy();
      // Nothing to link to without onPickExisting.
      expect(screen.queryByRole('button', { name: 'Link to this' })).toBeNull();

      expect(createButton().disabled).toBe(false);
      fireEvent.click(createButton());
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
    });

    it('hands a picked duplicate to onPickExisting instead of creating', async () => {
      mockMatches.mockResolvedValue(DUPLICATES);
      const onPickExisting = jest.fn();
      const { onCreated } = setup({ initialEnglish: 'Indra', onPickExisting });
      await pickAuthority();
      await screen.findByText('Possible duplicates', undefined, SLOW);

      const links = screen.getAllByRole('button', { name: 'Link to this' });
      expect(links).toHaveLength(2);
      fireEvent.click(links[1]);
      expect(onPickExisting).toHaveBeenCalledTimes(1);
      expect(onPickExisting).toHaveBeenCalledWith(DUPLICATES[1]);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(onCreated).not.toHaveBeenCalled();
    });

    it('shows no duplicates section when nothing matches', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      await waitFor(() => expect(mockMatches).toHaveBeenCalled());
      await act(async () => undefined);

      expect(screen.queryByText('Possible duplicates')).toBeNull();
      expect(
        screen.queryByText('Possible duplicates could not be checked.'),
      ).toBeNull();
      expect(createButton().disabled).toBe(false);
    });

    it('says when they could not be checked, and still creates', async () => {
      mockMatches.mockResolvedValue(null);
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();

      expect(
        await screen.findByText(
          'Possible duplicates could not be checked.',
          undefined,
          SLOW,
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Possible duplicates')).toBeNull();
      fireEvent.click(createButton());
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
    });
  });
});
