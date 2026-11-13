import { useContext, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor, Node } from '@tiptap/core';
import type {
  GlossaryAuthorityMatch,
  GlossaryEntry,
  GlossaryEntryMatch,
} from '@eightyfourthousand/data-access';

import { EditorContext } from '../../editor-context';
import { GlossaryInstanceNode } from '../../extensions/GlossaryInstance/GlossaryInstanceNode';
import { GlossarySelector } from './GlossarySelector';

// The stack's barrels reach `data-access/ssr`, which leaks these.
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
}));

const mockSearchTerms = jest.fn();
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  searchWorkGlossaryTerms: (args: unknown) => mockSearchTerms(args),
}));

jest.mock('../../../shared', () => ({
  ...jest.requireActual('../../../shared'),
  useNavigation: () => ({ uuid: 'work-1', editable: true }),
}));

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'passage+',
});
const Passage = Node.create({
  name: 'passage',
  group: 'block',
  content: 'paragraph+',
  addAttributes: () => ({ uuid: { default: null } }),
  parseHTML: () => [{ tag: 'div[uuid]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', HTMLAttributes, 0],
});
const Paragraph = Node.create({
  name: 'paragraph',
  content: 'inline*',
  renderHTML: () => ['p', 0],
});
const Text = Node.create({ name: 'text', group: 'inline' });

const editors: Editor[] = [];

/** "Indra" selected in a passage that says more. */
const editorWithSelection = () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [Document, Passage, Paragraph, Text, GlossaryInstanceNode],
    content: '<div uuid="p1"><p>Indra rules the gods</p></div>',
  });
  editor.commands.setTextSelection({ from: 2, to: 7 });
  editors.push(editor);
  return editor;
};

/** Every glossary instance in the document: its glossary and the text it covers. */
const instances = (editor: Editor) => {
  const found: { glossary: string; text: string }[] = [];
  editor.state.doc.descendants((node) => {
    node.marks
      .filter((mark) => mark.type.name === 'glossaryInstance')
      .forEach((mark) =>
        found.push({ glossary: mark.attrs.glossary, text: node.text ?? '' }),
      );
    return true;
  });
  return found;
};

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

/** `pending` is a permission check that has not answered: undefined. */
const open = async (editor: Editor, permission: boolean | 'pending' = true) => {
  render(<GlossarySelector editor={editor} />, {
    wrapper: withPermission(permission === 'pending' ? undefined : permission),
  });
  // The popover's only trigger is the one button rendered.
  fireEvent.click(screen.getByRole('button'));
  await screen.findByPlaceholderText('Search glossary by English term...');
};

const createOption = () =>
  screen.queryByRole('button', { name: 'Create entry' });

const openForm = async (editor: Editor) => {
  await open(editor);
  fireEvent.click(createOption() as HTMLElement);
  await screen.findByLabelText('English name');
};

/** Waits long enough for the debounced searches on a loaded machine. */
const SLOW = { timeout: 5000 };

const pickAuthority = async () => {
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Indra' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Indra/ }, SLOW));
  await screen.findByRole('button', { name: 'Change' }, SLOW);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchTerms.mockResolvedValue([]);
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

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('GlossarySelector: Create entry', () => {
  it('offers “Create entry” to an editor, alongside the results for the selected text', async () => {
    mockSearchTerms.mockResolvedValue([
      { uuid: 'g-1', termNumber: 3, names: { english: 'Indra' } },
    ]);
    await open(editorWithSelection());
    await screen.findByRole('button', { name: /g\.3/ }, SLOW);
    expect(createOption()).toBeTruthy();
    expect(
      (
        screen.getByPlaceholderText(
          'Search glossary by English term...',
        ) as HTMLInputElement
      ).value,
    ).toBe('Indra');
  });

  it('does not offer “Create entry” without editor.edit', async () => {
    await open(editorWithSelection(), false);
    await waitFor(() => expect(mockSearchTerms).toHaveBeenCalled());
    expect(createOption()).toBeNull();
  });

  it('does not offer “Create entry” before the permission check answers', async () => {
    await open(editorWithSelection(), 'pending');
    await waitFor(() => expect(mockSearchTerms).toHaveBeenCalled());
    expect(createOption()).toBeNull();
  });

  it('creates the entry and links the text selected when the popover opened', async () => {
    const editor = editorWithSelection();
    await openForm(editor);
    const name = screen.getByLabelText('English name') as HTMLInputElement;
    expect(name.value).toBe('Indra');
    fireEvent.change(name, { target: { value: 'Lord of Gods' } });
    await pickAuthority();
    fireEvent.click(screen.getByRole('button', { name: 'Create entry' }));

    await waitFor(() =>
      expect(instances(editor)).toEqual([
        { glossary: 'entry-new', text: 'Indra' },
      ]),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].workUuid).toBe('work-1');
    expect(mockCreate.mock.calls[0][0].entry.authorityUuid).toBe('auth-1');
    expect(mockCreate.mock.calls[0][0].entry.names[0].content).toBe(
      'Lord of Gods',
    );
    expect(editor.state.doc.textContent).toBe('Indra rules the gods');
    // The instance is a mark with its own uuid, as any other instance is.
    let uuid: unknown;
    editor.state.doc.descendants((node) => {
      node.marks.forEach((mark) => {
        if (mark.type.name === 'glossaryInstance') uuid = mark.attrs.uuid;
      });
      return true;
    });
    expect(typeof uuid).toBe('string');
    await waitFor(() =>
      expect(screen.queryByLabelText('English name')).toBeNull(),
    );
  });

  it('changes nothing in the passage when the entry cannot be created', async () => {
    mockCreate.mockResolvedValue({
      success: false,
      reason: 'failed',
      error: 'The database is unavailable.',
      outcomeUnknown: false,
    });
    const editor = editorWithSelection();
    const before = editor.getJSON();
    await openForm(editor);
    await pickAuthority();
    fireEvent.click(screen.getByRole('button', { name: 'Create entry' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The database is unavailable.');
    expect(instances(editor)).toEqual([]);
    expect(editor.getJSON()).toEqual(before);
    expect(editor.state.selection.from).toBe(2);
    expect(editor.state.selection.to).toBe(7);
    expect(screen.getByLabelText('English name')).toBeTruthy();
  });

  it('links the selection to a listed duplicate instead, creating nothing', async () => {
    mockMatches.mockResolvedValue([DUPLICATE]);
    const editor = editorWithSelection();
    await openForm(editor);
    await pickAuthority();

    await screen.findByText('Possible duplicates', undefined, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Link to this' }));

    await waitFor(() =>
      expect(instances(editor)).toEqual([
        { glossary: 'entry-existing', text: 'Indra' },
      ]),
    );
    expect(mockCreate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByLabelText('English name')).toBeNull(),
    );
  });

  it('does not link a range whose text changed while the entry was created', async () => {
    const editor = editorWithSelection();
    let finish: (value: unknown) => void = () => undefined;
    mockCreate.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await openForm(editor);
    await pickAuthority();
    fireEvent.click(screen.getByRole('button', { name: 'Create entry' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());

    editor.commands.insertContentAt(2, 'Lord ');
    finish({ success: true, entries: [NEW_ENTRY] });

    await waitFor(() =>
      expect(screen.queryByLabelText('English name')).toBeNull(),
    );
    expect(instances(editor)).toEqual([]);
  });
});
