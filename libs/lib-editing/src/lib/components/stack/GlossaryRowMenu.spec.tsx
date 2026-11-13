import { useContext, type ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  GlossaryAuthorityMatch,
  GlossaryEntry,
  GlossaryExcerptsPage,
} from '@eightyfourthousand/data-access';

import { EditorContext } from '../editor/editor-context';
import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';
import { glossaryEntryPanelOf } from './glossary-entry-panel';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockClient = { client: 'browser' };
const mockExcerpts = jest.fn();
const mockCreate = jest.fn();
const mockMatches = jest.fn();
const mockAuthoritySearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => mockClient,
  getGlossaryTermExcerpts: (args: unknown) => mockExcerpts(args),
  createGlossaryEntry: (args: unknown) => mockCreate(args),
  findGlossaryEntryMatches: (args: unknown) => mockMatches(args),
  searchGlossaryAuthorities: (args: unknown) => mockAuthoritySearch(args),
}));

const mockToast = jest.fn();
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  toast: (...args: unknown[]) => mockToast(...args),
}));

const ENTRY = {
  uuid: 'e1',
  names: [
    {
      nameUuid: 'n1',
      language: 'en',
      content: 'Indra',
      termType: 'translationMain',
    },
  ],
} as GlossaryEntry;

const excerpt = (uuid: string, label: string, instanceCount: number) => ({
  uuid,
  label,
  type: 'translation',
  sort: 1,
  toh: null,
  instanceCount,
  excerpt: {
    text: `${label} mentions Indra here`,
    truncatedStart: false,
    truncatedEnd: true,
    highlights: [],
  },
});

const PAGE: GlossaryExcerptsPage = {
  items: [excerpt('p1', '1.2', 1), excerpt('p2', '1.7', 3)],
  totalCount: 2,
  nextCursor: null,
  hasMore: false,
};

/** The editor as it is while a save runs. */
const Saving = ({ children }: { children: ReactNode }) => {
  const state = useContext(EditorContext);
  return (
    <EditorContext.Provider value={{ ...state, isSaving: () => true }}>
      {children}
    </EditorContext.Provider>
  );
};

const setup = ({ saving = false, readOnly = false } = {}) => {
  const remove = jest.fn().mockResolvedValue({ deleted: true });
  const controller = {
    getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
    getGlossaryEntry: () => ENTRY,
    getFocusedUuid: () => null,
    subscribe: () => () => undefined,
    isReadOnly: () => readOnly,
    focusPassage: jest.fn(),
    deleteGlossaryEntry: remove,
  } as unknown as StackController;
  const target = { uuid: 'e1', rect: { top: 0, left: 0, width: 1, height: 1 } };
  const onClose = jest.fn();
  const view = render(
    <GlossaryRowMenu
      controller={controller}
      target={target}
      onClose={onClose}
    />,
    saving ? { wrapper: Saving } : undefined,
  );
  // Opening the dialog closes the menu, which the stack does by clearing it.
  const openDialog = async () => {
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
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
  return { remove, openDialog, controller, onClose };
};

beforeEach(() => {
  mockExcerpts.mockReset();
});

describe('GlossaryRowMenu', () => {
  it('opens the entry panel on the row’s entry', async () => {
    const { controller, onClose } = setup();
    await act(async () => {
      fireEvent.click(screen.getByText('Edit Entry'));
    });
    expect(glossaryEntryPanelOf(controller).get()).toBe('e1');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers the entry panel but no delete when read-only', () => {
    setup({ readOnly: true });
    expect(screen.getByText('Edit Entry')).toBeTruthy();
    expect(screen.getByText('Copy Link')).toBeTruthy();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('offers delete, which asks first and lists the passages with instances', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    await openDialog();

    expect(screen.getByText('Delete g.4 Indra')).toBeTruthy();
    expect(mockExcerpts).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'e1', source: 'draft' }),
    );
    expect(screen.getByText(/instances in 2 passages/)).toBeTruthy();
    expect(screen.getByText('1.2')).toBeTruthy();
    expect(screen.getByText('1 instance')).toBeTruthy();
    expect(screen.getByText('1.7')).toBeTruthy();
    expect(screen.getByText('3 instances')).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });

  it('counts the passages past the ones listed', async () => {
    mockExcerpts.mockResolvedValue({ ...PAGE, totalCount: 60, hasMore: true });
    const { openDialog } = setup();
    await openDialog();
    expect(screen.getByText(/instances in 60 passages/)).toBeTruthy();
    expect(screen.getByText('and 58 more passages.')).toBeTruthy();
  });

  it('says so when no passage has an instance', async () => {
    mockExcerpts.mockResolvedValue({ ...PAGE, items: [], totalCount: 0 });
    const { openDialog } = setup();
    await openDialog();
    expect(screen.getByText('No passage has an instance of it.')).toBeTruthy();
  });

  it('cancelling changes nothing', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete g.4 Indra')).toBeNull();
  });

  it('confirming deletes the entry and closes', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(remove).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ passages: [] }),
    );
    expect(screen.queryByText('Delete g.4 Indra')).toBeNull();
  });

  it('waits for a running save before deleting', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup({ saving: true });
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('save is running');
    expect(screen.getByText('Delete g.4 Indra')).toBeTruthy();
  });

  it('keeps the dialog open when the delete throws', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    remove.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('keeps the dialog open with the reason when the delete is refused', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    remove.mockResolvedValue({ deleted: false, error: 'Not allowed' });
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Not allowed');
    expect(screen.getByText('Delete g.4 Indra')).toBeTruthy();
  });
});

describe('GlossaryRowMenu: New Entry', () => {
  const AUTHORITY: GlossaryAuthorityMatch = {
    uuid: 'auth-1',
    headword: 'Indra',
    headwordLanguage: 'Sa-Ltn',
    definition: null,
    names: [],
    matchedName: null,
  };
  const NEW_ENTRY = { uuid: 'entry-new', workUuid: 'work-1' } as GlossaryEntry;
  /** Waits long enough for the debounced searches on a loaded machine. */
  const SLOW = { timeout: 5000 };

  /** The editor context, with permission to edit or not. */
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

  const setupNew = (editPermitted: boolean | undefined) => {
    const addGlossaryRow = jest.fn().mockResolvedValue(true);
    const controller = {
      getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
      getGlossaryEntry: () => undefined,
      deleteGlossaryEntry: jest.fn(),
      addGlossaryRow,
      isReadOnly: () => false,
    } as unknown as StackController;
    const target = {
      uuid: 'e1',
      rect: { top: 0, left: 0, width: 1, height: 1 },
    };
    const onClose = jest.fn();
    const view = render(
      <GlossaryRowMenu
        controller={controller}
        target={target}
        onClose={onClose}
      />,
      { wrapper: withPermission(editPermitted) },
    );
    // Choosing an item closes the menu, which the stack does by clearing it.
    const choose = async () => {
      await act(async () => {
        fireEvent.click(screen.getByText('New Entry'));
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
    return { addGlossaryRow, choose };
  };

  const fillAndCreate = async () => {
    fireEvent.change(await screen.findByLabelText('English name'), {
      target: { value: 'Indra' },
    });
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Indra' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Indra/ }, SLOW));
    await screen.findByRole('button', { name: 'Change' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Create entry' }));
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

  it('is offered only once the editor may edit', () => {
    setupNew(false);
    expect(screen.queryByText('New Entry')).toBeNull();
    cleanup();
    setupNew(undefined);
    expect(screen.queryByText('New Entry')).toBeNull();
    cleanup();
    setupNew(true);
    expect(screen.getByText('New Entry')).toBeTruthy();
  });

  it('creates the entry and places its row through the controller', async () => {
    const { choose, addGlossaryRow } = setupNew(true);
    await choose();
    await fillAndCreate();

    await waitFor(() => expect(addGlossaryRow).toHaveBeenCalledTimes(1));
    expect(addGlossaryRow).toHaveBeenCalledWith(
      NEW_ENTRY,
      expect.objectContaining({ client: mockClient }),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].workUuid).toBe('work-1');
    expect(mockCreate.mock.calls[0][0].entry.names[0]).toEqual(
      expect.objectContaining({ language: 'en', content: 'Indra' }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText('English name')).toBeNull(),
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('says so when the new row cannot be shown', async () => {
    const { choose, addGlossaryRow } = setupNew(true);
    addGlossaryRow.mockResolvedValue(false);
    await choose();
    await fillAndCreate();

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText('English name')).toBeNull();
  });

  it('closes without creating anything on Cancel', async () => {
    const { choose, addGlossaryRow } = setupNew(true);
    await choose();
    // Nothing is selected to name the entry from, so the form starts empty.
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
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByLabelText('English name')).toBeNull(),
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(addGlossaryRow).not.toHaveBeenCalled();
  });
});
