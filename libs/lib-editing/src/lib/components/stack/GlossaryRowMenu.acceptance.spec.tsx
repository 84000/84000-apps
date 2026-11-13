// DEV-910 acceptance: the glossary row label menu's "New Entry"
// (criteria 5, 6, 10; 9 for the duplicate list without a link option).
import { useContext, type ReactNode } from 'react';
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

import { EditorContext } from '../editor/editor-context';
import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';

// See GlossaryRowMenu.spec.tsx: the stack's barrels reach `data-access/ssr`.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockClient = { client: 'browser' };
const mockCreate = jest.fn();
const mockMatches = jest.fn();
const mockAuthoritySearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => mockClient,
  createGlossaryEntry: (args: unknown) => mockCreate(args),
  findGlossaryEntryMatches: (args: unknown) => mockMatches(args),
  searchGlossaryAuthorities: (args: unknown) => mockAuthoritySearch(args),
  getGlossaryTermExcerpts: jest.fn().mockResolvedValue(null),
}));

const AUTHORITY: GlossaryAuthorityMatch = {
  uuid: 'auth-1',
  headword: 'Indra',
  headwordLanguage: 'Sa-Ltn',
  definition: null,
  names: [],
  matchedName: null,
};

const NEW_ENTRY = {
  uuid: 'entry-new',
  workUuid: 'work-1',
  authorityUuid: 'auth-1',
  definition: null,
  definitionRend: null,
  glossMode: 'match',
  names: [],
} as GlossaryEntry;

const DUPLICATE: GlossaryEntryMatch = {
  uuid: 'entry-existing',
  label: 'g.3',
  english: 'Indra',
  authorityUuid: 'auth-1',
  sameName: true,
  sameAuthority: true,
};

const withPermission = (editPermitted: boolean | undefined) => {
  const Provider = ({ children }: { children: ReactNode }) => {
    const state = useContext(EditorContext);
    return (
      <EditorContext.Provider
        value={{
          ...state,
          editPermitted,
          work: { ...state.work, uuid: 'work-1' },
        }}
      >
        {children}
      </EditorContext.Provider>
    );
  };
  return Provider;
};

const setup = (editPermitted: boolean | undefined) => {
  const addGlossaryRow = jest.fn().mockResolvedValue(true);
  const controller = {
    getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
    getGlossaryEntry: () => undefined,
    deleteGlossaryEntry: jest.fn(),
    addGlossaryRow,
  } as unknown as StackController;
  const target = { uuid: 'e1', rect: { top: 0, left: 0, width: 1, height: 1 } };
  const onClose = jest.fn();
  const wrapper = withPermission(editPermitted);
  const view = render(
    <GlossaryRowMenu
      controller={controller}
      target={target}
      onClose={onClose}
    />,
    { wrapper },
  );
  // Choosing an item closes the menu, which the stack does by clearing the target.
  const choose = async (name: string) => {
    await act(async () => {
      fireEvent.click(screen.getByText(name));
    });
    view.rerender(
      <GlossaryRowMenu
        controller={controller}
        target={null}
        onClose={onClose}
      />,
    );
    await act(async () => undefined);
  };
  return { addGlossaryRow, controller, choose };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthoritySearch.mockResolvedValue([AUTHORITY]);
  mockMatches.mockResolvedValue([]);
  mockCreate.mockResolvedValue({
    success: true,
    dryRun: false,
    entries: [NEW_ENTRY],
    deleted: [],
    changes: {},
  });
});

describe('GlossaryRowMenu: New Entry', () => {
  describe('permission (criterion 10)', () => {
    it('is in the menu for an editor (5)', () => {
      setup(true);
      expect(screen.getByText('New Entry')).toBeTruthy();
    });

    it('is not in the menu without editor.edit', () => {
      setup(false);
      expect(screen.queryByText('New Entry')).toBeNull();
    });

    it('is not in the menu before the permission check answers', () => {
      setup(undefined);
      expect(screen.queryByText('New Entry')).toBeNull();
    });
  });

  describe('creating (criteria 5, 6)', () => {
    it('opens the form with an empty English name (5)', async () => {
      const { choose } = setup(true);
      await choose('New Entry');

      const name = (await screen.findByLabelText(
        'English name',
      )) as HTMLInputElement;
      expect(name.value).toBe('');
      expect(
        (
          screen.getByRole('button', {
            name: 'Create entry',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

    it('creates the entry and places its row in the stack through the controller (6)', async () => {
      const { choose, addGlossaryRow } = setup(true);
      await choose('New Entry');
      fireEvent.change(await screen.findByLabelText('English name'), {
        target: { value: 'Indra' },
      });
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Indra' },
      });
      fireEvent.click(await screen.findByRole('button', { name: /Indra/ }));
      await screen.findByRole('button', { name: 'Change' });
      fireEvent.click(screen.getByRole('button', { name: 'Create entry' }));

      await waitFor(() => expect(addGlossaryRow).toHaveBeenCalledTimes(1));
      expect(addGlossaryRow).toHaveBeenCalledWith(
        NEW_ENTRY,
        expect.objectContaining({ client: mockClient }),
      );
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate.mock.calls[0][0].entry.names[0]).toEqual(
        expect.objectContaining({ language: 'en', content: 'Indra' }),
      );
      // Saved through the editor's work.
      expect(mockCreate.mock.calls[0][0].workUuid).toBe('work-1');
      // The dialog closes once the row is placed.
      await waitFor(() =>
        expect(screen.queryByLabelText('English name')).toBeNull(),
      );
    });

    it('does not place a row when the entry cannot be created, and shows why', async () => {
      mockCreate.mockResolvedValue({
        success: false,
        reason: 'failed',
        error: 'The database is unavailable.',
        outcomeUnknown: false,
      });
      const { choose, addGlossaryRow } = setup(true);
      await choose('New Entry');
      fireEvent.change(await screen.findByLabelText('English name'), {
        target: { value: 'Indra' },
      });
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Indra' },
      });
      fireEvent.click(await screen.findByRole('button', { name: /Indra/ }));
      await screen.findByRole('button', { name: 'Change' });
      fireEvent.click(screen.getByRole('button', { name: 'Create entry' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('The database is unavailable.');
      expect(addGlossaryRow).not.toHaveBeenCalled();
    });

    it('closes the dialog without creating anything on Cancel', async () => {
      const { choose, addGlossaryRow } = setup(true);
      await choose('New Entry');
      await screen.findByLabelText('English name');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.queryByLabelText('English name')).toBeNull(),
      );
      expect(mockCreate).not.toHaveBeenCalled();
      expect(addGlossaryRow).not.toHaveBeenCalled();
    });

    it('lists possible duplicates, with no link option, as there is no passage to link (9)', async () => {
      mockMatches.mockResolvedValue([DUPLICATE]);
      const { choose } = setup(true);
      await choose('New Entry');
      fireEvent.change(await screen.findByLabelText('English name'), {
        target: { value: 'Indra' },
      });
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Indra' },
      });
      fireEvent.click(await screen.findByRole('button', { name: /Indra/ }));
      await screen.findByRole('button', { name: 'Change' });

      expect(await screen.findByText('Possible duplicates')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Link to this' })).toBeNull();
      expect(
        (
          screen.getByRole('button', {
            name: 'Create entry',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
  });
});
