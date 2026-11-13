import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  GlossaryAuthorityMatch,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import { GlossaryEntryForm } from './GlossaryEntryForm';

// The stack's barrels reach `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockCreate = jest.fn();
const mockMatches = jest.fn();
const mockSearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  createGlossaryEntry: (args: unknown) => mockCreate(args),
  findGlossaryEntryMatches: (args: unknown) => mockMatches(args),
  searchGlossaryAuthorities: (args: unknown) => mockSearch(args),
}));

const AUTHORITY: GlossaryAuthorityMatch = {
  uuid: 'auth-1',
  headword: 'Indra',
  headwordLanguage: 'Sa-Ltn',
  definition: null,
  names: [],
  matchedName: null,
};

const ENTRY = { uuid: 'entry-new' } as GlossaryEntry;

const setup = (onCreated = jest.fn()) => {
  render(
    <GlossaryEntryForm
      workUuid="work-1"
      initialEnglish="Indra"
      onCreated={onCreated}
      onCancel={jest.fn()}
    />,
  );
  return onCreated;
};

const pickAuthority = async () => {
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Indra' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Indra/ }));
  await screen.findByRole('button', { name: 'Change' });
};

const createButton = () =>
  screen.getByRole('button', { name: 'Create entry' }) as HTMLButtonElement;

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch.mockResolvedValue([AUTHORITY]);
  mockMatches.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ success: true, entries: [ENTRY] });
});

describe('GlossaryEntryForm', () => {
  it('stores the definition as escaped paragraphs and line breaks', async () => {
    setup();
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

  it('does not offer to create again when what follows the create fails', async () => {
    setup(jest.fn().mockRejectedValue(new Error('not shown')));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
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

  it('says when possible duplicates could not be checked', async () => {
    mockMatches.mockResolvedValue(null);
    setup();
    expect(
      await screen.findByText('Possible duplicates could not be checked.'),
    ).toBeTruthy();
  });
});
