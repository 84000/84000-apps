// DEV-910 acceptance: the form that creates a glossary entry, shared by the
// link popover and the row menu. Criteria 2, 4, 7, 8, 9 (and 3's "link to the
// existing entry instead" through onPickExisting).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const INDRA_AUTHORITY: GlossaryAuthorityMatch = {
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
const pickAuthority = async (headword = 'Indra') => {
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: headword },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Indra/ }));
  await screen.findByRole('button', { name: 'Change' });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch.mockResolvedValue([INDRA_AUTHORITY]);
  mockMatches.mockResolvedValue([]);
  mockCreate.mockResolvedValue(SUCCESS);
});

describe('GlossaryEntryForm', () => {
  describe('fields (criteria 2, 7, 8)', () => {
    it('prefills the English name, and the editor can change it (2)', () => {
      setup({ initialEnglish: 'Indra' });
      expect(englishInput().value).toBe('Indra');

      setName('Lord Indra');
      expect(englishInput().value).toBe('Lord Indra');
    });

    it('starts with an empty English name when none is given (5)', () => {
      setup();
      expect(englishInput().value).toBe('');
    });

    it('has an optional Definition field (8)', () => {
      setup();
      const definition = screen.getByLabelText('Definition');
      expect(definition.tagName).toBe('TEXTAREA');
      expect((definition as HTMLTextAreaElement).value).toBe('');
    });

    it('offers an authority search by any name (7)', async () => {
      setup();
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'dbang po' },
      });
      await waitFor(() =>
        expect(mockSearch).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'dbang po' }),
        ),
      );
    });

    it('shows the picked authority’s headword with a Change button (7)', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();

      expect(
        screen.getAllByText('Indra', { selector: ':not(input)' }).length,
      ).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Change' }));
      expect(screen.getByRole('searchbox')).toBeTruthy();
    });

    it('says that new authorities are added through the agent tools (7)', async () => {
      setup();
      const note = 'New authorities are added through the agent tools.';
      expect(screen.getByText(note)).toBeTruthy();

      // Still there once a search finds nothing.
      mockSearch.mockResolvedValue([]);
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'zzz' },
      });
      await screen.findByText(/No authority matches/);
      expect(screen.getByText(note)).toBeTruthy();
    });

    it('offers no way to create an authority (7)', async () => {
      setup({ initialEnglish: 'Indra' });
      mockSearch.mockResolvedValue([]);
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'zzz' },
      });
      await screen.findByText(/No authority matches/);

      expect(
        screen.queryByRole('button', { name: /(create|add|new)\b.*authorit/i }),
      ).toBeNull();
      expect(
        screen.queryByRole('link', { name: /(create|add|new)\b.*authorit/i }),
      ).toBeNull();
      // The one thing the form creates is the entry.
      expect(
        screen
          .getAllByRole('button')
          .filter((b) => /create/i.test(b.textContent ?? ''))
          .map((b) => b.textContent),
      ).toEqual(['Create entry']);
    });

    it('cancels through onCancel', () => {
      const { onCancel, onCreated } = setup({ initialEnglish: 'Indra' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onCreated).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('confirming needs a name and an authority (7)', () => {
    it('is disabled with neither', () => {
      setup();
      expect(createButton().disabled).toBe(true);
    });

    it('is disabled with a name but no authority', () => {
      setup({ initialEnglish: 'Indra' });
      expect(createButton().disabled).toBe(true);
    });

    it('is disabled with an authority but no name', async () => {
      setup();
      await pickAuthority();
      expect(createButton().disabled).toBe(true);
    });

    it('is disabled with a blank name', async () => {
      setup();
      await pickAuthority();
      setName('   ');
      expect(createButton().disabled).toBe(true);
    });

    it('is enabled with both', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      expect(createButton().disabled).toBe(false);

      setName('');
      expect(createButton().disabled).toBe(true);
      setName('Indra');
      expect(createButton().disabled).toBe(false);
    });

    it('does not save while disabled', () => {
      setup({ initialEnglish: 'Indra' });
      fireEvent.click(createButton());
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('saving (criteria 3, 8)', () => {
    it('creates the entry through createGlossaryEntry with the chosen authority and English name', async () => {
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.click(createButton());

      await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const args = mockCreate.mock.calls[0][0];
      expect(args.client).toBe(mockClient);
      expect(args.workUuid).toBe(WORK);
      expect(args.entry.authorityUuid).toBe('auth-1');
      expect(args.entry.definition).toBeNull();
      expect(args.entry.names).toEqual([
        {
          language: 'en',
          content: 'Indra',
          contentTransformed: null,
          termType: 'translationMain',
          attestation: null,
        },
      ]);
    });

    it('saves the English name as edited', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      setName('Lord Indra');
      fireEvent.click(createButton());

      await waitFor(() => expect(mockCreate).toHaveBeenCalled());
      expect(mockCreate.mock.calls[0][0].entry.names[0]).toEqual(
        expect.objectContaining({ language: 'en', content: 'Lord Indra' }),
      );
    });

    it('hands the created entry to onCreated, once the save has succeeded (3)', async () => {
      let finish: (value: unknown) => void = () => undefined;
      mockCreate.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.click(createButton());

      await waitFor(() => expect(mockCreate).toHaveBeenCalled());
      expect(onCreated).not.toHaveBeenCalled();

      finish(SUCCESS);
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
    });

    it('passes a typed definition as HTML (8)', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.change(screen.getByLabelText('Definition'), {
        target: { value: 'King of the gods.' },
      });
      fireEvent.click(createButton());

      await waitFor(() => expect(mockCreate).toHaveBeenCalled());
      const { definition } = mockCreate.mock.calls[0][0].entry;
      expect(typeof definition).toBe('string');
      expect(definition).toContain('King of the gods.');
    });

    it('passes no definition as null (8)', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.change(screen.getByLabelText('Definition'), {
        target: { value: '   ' },
      });
      fireEvent.click(createButton());

      await waitFor(() => expect(mockCreate).toHaveBeenCalled());
      expect(mockCreate.mock.calls[0][0].entry.definition).toBeNull();
    });
  });

  describe('failure (criterion 4)', () => {
    const FAILURE = {
      success: false,
      reason: 'failed',
      error: 'The database is unavailable.',
      outcomeUnknown: false,
    };

    it('shows the error in an alert and does not call onCreated', async () => {
      mockCreate.mockResolvedValue(FAILURE);
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.click(createButton());

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('The database is unavailable.');
      expect(onCreated).not.toHaveBeenCalled();
    });

    it('keeps the form, with what was typed, so the editor can try again', async () => {
      mockCreate.mockResolvedValue(FAILURE);
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.click(createButton());
      await screen.findByRole('alert');

      expect(englishInput().value).toBe('Indra');
      expect(createButton().disabled).toBe(false);

      mockCreate.mockResolvedValue(SUCCESS);
      fireEvent.click(createButton());
      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    });

    it('does not call onCreated when the save throws', async () => {
      mockCreate.mockRejectedValue(new Error('offline'));
      const error = jest.spyOn(console, 'error').mockImplementation(() => null);
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      fireEvent.click(createButton());

      await waitFor(() => expect(mockCreate).toHaveBeenCalled());
      await screen.findByRole('alert');
      expect(onCreated).not.toHaveBeenCalled();
      error.mockRestore();
    });
  });

  describe('possible duplicates (criterion 9)', () => {
    it('asks for matches with the English name and the chosen authority', async () => {
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();

      await waitFor(() =>
        expect(mockMatches).toHaveBeenCalledWith(
          expect.objectContaining({
            client: mockClient,
            workUuid: WORK,
            english: 'Indra',
            authorityUuid: 'auth-1',
          }),
        ),
      );
    });

    it('lists the matches under “Possible duplicates” with their label, name and why', async () => {
      mockMatches.mockResolvedValue(DUPLICATES);
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();

      expect(await screen.findByText('Possible duplicates')).toBeTruthy();
      expect(screen.getByText('g.3')).toBeTruthy();
      expect(screen.getByText('Lord of Gods')).toBeTruthy();
      expect(screen.getByText(/same name/i)).toBeTruthy();
      expect(screen.getByText('g.12')).toBeTruthy();
      expect(screen.getByText('Śakra')).toBeTruthy();
      expect(screen.getByText(/same authority/i)).toBeTruthy();
    });

    it('shows no duplicates section when nothing matches', async () => {
      mockMatches.mockResolvedValue([]);
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      await waitFor(() => expect(mockMatches).toHaveBeenCalled());

      expect(screen.queryByText('Possible duplicates')).toBeNull();
    });

    it('offers “Link to this” on each duplicate when onPickExisting is given, and hands it that match', async () => {
      mockMatches.mockResolvedValue(DUPLICATES);
      const onPickExisting = jest.fn();
      const { onCreated } = setup({ initialEnglish: 'Indra', onPickExisting });
      await pickAuthority();
      await screen.findByText('Possible duplicates');

      const links = screen.getAllByRole('button', { name: 'Link to this' });
      expect(links).toHaveLength(2);

      fireEvent.click(links[1]);
      expect(onPickExisting).toHaveBeenCalledTimes(1);
      expect(onPickExisting).toHaveBeenCalledWith(DUPLICATES[1]);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(onCreated).not.toHaveBeenCalled();
    });

    it('offers no “Link to this” without onPickExisting', async () => {
      mockMatches.mockResolvedValue(DUPLICATES);
      setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      await screen.findByText('Possible duplicates');

      expect(screen.queryByRole('button', { name: 'Link to this' })).toBeNull();
    });

    it('still allows creating anyway', async () => {
      mockMatches.mockResolvedValue(DUPLICATES);
      const { onCreated } = setup({
        initialEnglish: 'Indra',
        onPickExisting: jest.fn(),
      });
      await pickAuthority();
      await screen.findByText('Possible duplicates');

      expect(createButton().disabled).toBe(false);
      fireEvent.click(createButton());
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('still allows creating when the duplicate check fails', async () => {
      mockMatches.mockResolvedValue(null);
      const { onCreated } = setup({ initialEnglish: 'Indra' });
      await pickAuthority();
      await waitFor(() => expect(mockMatches).toHaveBeenCalled());

      expect(screen.queryByText('Possible duplicates')).toBeNull();
      fireEvent.click(createButton());
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ENTRY));
    });
  });
});
