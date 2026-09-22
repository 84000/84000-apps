import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor, Node } from '@tiptap/core';
import { AnnotationToh } from '../../extensions/AnnotationToh';
import { CommentMark } from '../../extensions/Comment/CommentMark';
import { CommentSelector } from './CommentSelector';

const mockCreateComment = jest.fn();
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  createComment: (...args: unknown[]) => mockCreateComment(...args),
}));

const mockRefreshComments = jest.fn();
const mockSetFocusedComment = jest.fn();
const mockUpdatePanel = jest.fn();
const navigation = { editable: true };
jest.mock('../../../shared', () => ({
  useNavigation: () => ({
    editable: navigation.editable,
    refreshComments: mockRefreshComments,
    setFocusedComment: mockSetFocusedComment,
    updatePanel: mockUpdatePanel,
  }),
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

/**
 * Torn down after each test: the selector defers its document write past the
 * popover's focus restore, and a destroyed editor is what stops a straggling
 * timer from reaching into the next test.
 */
const editors: Editor[] = [];

const editorWithSelection = () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      Document,
      Passage,
      Paragraph,
      Text,
      AnnotationToh,
      CommentMark,
    ],
    content: '<div uuid="p1"><p>needs a source check</p></div>',
  });
  editor.commands.setTextSelection({ from: 2, to: 7 });
  editors.push(editor);
  return editor;
};

/** Every comment anchor in the document. */
const anchors = (editor: Editor) => {
  const found: string[] = [];
  editor.state.doc.descendants((node) => {
    node.marks
      .filter((mark) => mark.type.name === 'comment')
      .forEach((mark) => found.push(mark.attrs.comment));
    return true;
  });
  return found;
};

const comment = async (body: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Comment on selection' }),
  );
  // Set rather than typed: a per-keystroke type is slow enough to time the
  // test out on a loaded machine, and the composer reads the value either way.
  fireEvent.change(await screen.findByPlaceholderText('Add a comment…'), {
    target: { value: body },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  navigation.editable = true;
});

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('CommentSelector', () => {
  it('creates the thread first, then anchors the mark to it', async () => {
    const editor = editorWithSelection();
    const order: string[] = [];
    mockCreateComment.mockImplementation(async () => {
      order.push('create');
      expect(anchors(editor)).toEqual([]);
      return { success: true, comment: { uuid: 't1' } };
    });

    render(<CommentSelector editor={editor} />);
    await comment('check this');

    await waitFor(() => expect(anchors(editor)).toEqual(['t1']));
    expect(order).toEqual(['create']);
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ entityUuid: 'p1', entityType: 'passage' }),
    );
  });

  it('leaves no mark when the thread cannot be created', async () => {
    // A mark naming a thread that does not exist is debris the panel cannot
    // render and the user cannot remove.
    const editor = editorWithSelection();
    mockCreateComment.mockResolvedValue({
      success: false,
      error: 'Permission denied',
    });

    render(<CommentSelector editor={editor} />);
    await comment('check this');

    await waitFor(() => expect(mockCreateComment).toHaveBeenCalled());
    expect(anchors(editor)).toEqual([]);
    expect(mockSetFocusedComment).not.toHaveBeenCalled();
  });

  it('opens the panel on the new thread', async () => {
    const editor = editorWithSelection();
    mockCreateComment.mockResolvedValue({
      success: true,
      comment: { uuid: 't1' },
    });

    render(<CommentSelector editor={editor} />);
    await comment('check this');

    await waitFor(() =>
      expect(mockSetFocusedComment).toHaveBeenCalledWith('t1'),
    );
    expect(mockRefreshComments).toHaveBeenCalled();
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'left',
      state: { open: true, tab: 'comments', hash: 't1' },
    });
  });

  it('stays out of the reader', async () => {
    navigation.editable = false;

    const { container } = render(
      <CommentSelector editor={editorWithSelection()} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
