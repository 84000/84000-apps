import { Editor, Node } from '@tiptap/core';
import { AnnotationToh } from '../AnnotationToh';
import { CommentMark } from './CommentMark';

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph+',
});

const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  renderHTML: () => ['p', 0],
});

const Text = Node.create({
  name: 'text',
  group: 'inline',
});

const editorWith = (text: string) =>
  new Editor({
    element: document.createElement('div'),
    extensions: [Document, Paragraph, Text, AnnotationToh, CommentMark],
    content: `<p>${text}</p>`,
  });

/** Every comment anchor in the document, in document order. */
const anchors = (editor: Editor) => {
  const found: { comment: string; uuid: string; text: string }[] = [];
  editor.state.doc.descendants((node) => {
    if (!node.isText) return true;
    node.marks
      .filter((mark) => mark.type.name === 'comment')
      .forEach((mark) =>
        found.push({
          comment: mark.attrs.comment,
          uuid: mark.attrs.uuid,
          text: node.text ?? '',
        }),
      );
    return true;
  });
  return found;
};

describe('setComment', () => {
  it('stamps a fresh anchor uuid distinct from the thread uuid', () => {
    const editor = editorWith('one two three');
    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.setComment({ comment: 'thread-1' });

    const [anchor] = anchors(editor);
    expect(anchor.comment).toBe('thread-1');
    expect(anchor.uuid).toEqual(expect.any(String));
    expect(anchor.uuid).not.toBe('thread-1');

    editor.destroy();
  });

  /**
   * Two anchors on one thread is the intended shape, not an error state — a
   * split inside a commented range produces exactly this, because `ensureUuids`
   * stamps a fresh uuid on the duplicated mark
   * (`2026-09-11-comment-anchor-splits-only-inside-the-range`).
   */
  it('accepts a second anchor on a thread that already has one', () => {
    const editor = editorWith('one two three');
    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.setComment({ comment: 'thread-1' });
    editor.commands.setTextSelection({ from: 9, to: 14 });
    editor.commands.setComment({ comment: 'thread-1' });

    const found = anchors(editor);
    expect(found).toHaveLength(2);
    expect(found.map((a) => a.comment)).toEqual(['thread-1', 'thread-1']);
    expect(found[0].uuid).not.toBe(found[1].uuid);

    editor.destroy();
  });

  it('adds a second thread over the same words instead of replacing the first', () => {
    const editor = editorWith('one two three');
    editor.commands.setTextSelection({ from: 1, to: 8 });
    editor.commands.setComment({ comment: 'thread-1' });
    editor.commands.setComment({ comment: 'thread-2' });

    expect(
      anchors(editor)
        .map((a) => a.comment)
        .sort(),
    ).toEqual(['thread-1', 'thread-2']);

    editor.destroy();
  });
});

describe('unsetComment', () => {
  it('removes every anchor on the named thread', () => {
    const editor = editorWith('one two three');
    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.setComment({ comment: 'thread-1' });
    editor.commands.setTextSelection({ from: 9, to: 14 });
    editor.commands.setComment({ comment: 'thread-1' });

    expect(editor.commands.unsetComment({ comment: 'thread-1' })).toBe(true);
    expect(anchors(editor)).toEqual([]);

    editor.destroy();
  });

  // `unsetMark` takes every mark of the type in the range, which would strip a
  // bystander thread off the same words and delete its anchor row on save.
  it('leaves an overlapping anchor on another thread alone', () => {
    const editor = editorWith('one two three');
    editor.commands.setTextSelection({ from: 1, to: 8 });
    editor.commands.setComment({ comment: 'thread-1' });
    editor.commands.setComment({ comment: 'thread-2' });

    editor.commands.unsetComment({ comment: 'thread-1' });

    expect(anchors(editor).map((a) => a.comment)).toEqual(['thread-2']);

    editor.destroy();
  });

  it('reports nothing to do when the thread has no anchor', () => {
    const editor = editorWith('one two three');

    expect(editor.commands.unsetComment({ comment: 'thread-1' })).toBe(false);

    editor.destroy();
  });
});
