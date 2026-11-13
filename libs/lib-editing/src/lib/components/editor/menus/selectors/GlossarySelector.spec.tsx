import { useContext, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor, Node } from '@tiptap/core';
import type {
  GlossaryAuthorityMatch,
  GlossaryEntry,
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

const mockCreate = jest.fn();
const AUTHORITY: GlossaryAuthorityMatch = {
  uuid: 'auth-1',
  headword: 'Indra',
  headwordLanguage: 'Sa-Ltn',
  definition: null,
  names: [],
  matchedName: null,
};
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  createGlossaryEntry: (args: unknown) => mockCreate(args),
  findGlossaryEntryMatches: async () => [],
  searchGlossaryAuthorities: async () => [AUTHORITY],
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  searchWorkGlossaryTerms: async () => [],
}));
jest.mock('../../../shared', () => ({
  ...jest.requireActual('../../../shared'),
  useNavigation: () => ({ uuid: 'work-1', editable: true }),
}));

const Document = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  renderHTML: () => ['p', 0],
});
const Text = Node.create({ name: 'text', group: 'inline' });

const Editable = ({ children }: { children: ReactNode }) => {
  const state = useContext(EditorContext);
  return (
    <EditorContext.Provider value={{ ...state, editPermitted: true }}>
      {children}
    </EditorContext.Provider>
  );
};

const hasInstance = (editor: Editor) => {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.marks.some((mark) => mark.type.name === 'glossaryInstance')) {
      found = true;
    }
    return true;
  });
  return found;
};

let editor: Editor;
afterEach(() => editor.destroy());

it('does not link a range whose text changed while the entry was created', async () => {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, GlossaryInstanceNode],
    content: '<p>Indra rules the gods</p>',
  });
  editor.commands.setTextSelection({ from: 1, to: 6 });
  let finish: (value: unknown) => void = () => undefined;
  mockCreate.mockReturnValue(new Promise((resolve) => (finish = resolve)));

  render(<GlossarySelector editor={editor} />, { wrapper: Editable });
  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(await screen.findByRole('button', { name: 'Create entry' }));
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Indra' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Indra/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Create entry' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalled());

  editor.commands.insertContentAt(1, 'Lord ');
  finish({ success: true, entries: [{ uuid: 'entry-new' } as GlossaryEntry] });

  await waitFor(() =>
    expect(screen.queryByLabelText('English name')).toBeNull(),
  );
  expect(hasInstance(editor)).toBe(false);
});
