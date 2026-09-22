import { Editor, Node } from '@tiptap/core';
import { passageUuidForSelection } from './util';

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

const editorFor = (content: string, element?: HTMLElement) =>
  new Editor({
    element: element ?? document.createElement('div'),
    extensions: [Document, Passage, Paragraph, Text],
    content,
  });

describe('passageUuidForSelection', () => {
  it('reads the passage node the selection sits in', () => {
    const editor = editorFor(
      '<div uuid="p1"><p>first</p></div><div uuid="p2"><p>second</p></div>',
    );

    editor.commands.setTextSelection({ from: 12, to: 18 });

    expect(passageUuidForSelection(editor)).toBe('p2');
  });

  it('falls back to the row when the document holds no passage node', () => {
    // The stack mounts one editor per passage, so the row — not the document —
    // is what names it.
    const row = document.createElement('div');
    row.setAttribute('data-stack-passage', 'p9');
    const mount = document.createElement('div');
    row.appendChild(mount);
    document.body.appendChild(row);

    const editor = editorFor('<div uuid=""><p>only</p></div>', mount);
    editor.commands.setTextSelection({ from: 2, to: 5 });

    expect(passageUuidForSelection(editor)).toBe('p9');
  });

  it('names nothing when neither the document nor the row does', () => {
    const editor = editorFor('<div uuid=""><p>orphan</p></div>');

    expect(passageUuidForSelection(editor)).toBeUndefined();
  });
});
