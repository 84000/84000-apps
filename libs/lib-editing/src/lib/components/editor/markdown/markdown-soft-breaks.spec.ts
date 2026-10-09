import { Editor, type JSONContent } from '@tiptap/core';
import {
  checkMarkdownRoundTrip,
  markdownFormatOf,
  parseMarkdown,
  serializeMarkdown,
} from './markdown-codec';
import { createMarkdownExtensions } from './markdown-extensions';
import { editTextNodes, mountMarkdown } from './markdown-editing.fixture';

/**
 * A source's soft line breaks are newlines in text; a hard break is a node.
 * Editing a paragraph must keep each as it is.
 */

const serialize = (editor: Editor, source: string) =>
  serializeMarkdown(editor.getJSON(), markdownFormatOf(source));

const hasHardBreak = (node: JSONContent): boolean =>
  node.type === 'hardBreak' || (node.content ?? []).some(hasHardBreak);

describe('markdown soft breaks', () => {
  let editor: Editor | undefined;
  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it.each([
    [
      'a paragraph',
      'An excerpt\nfrom the source.\n',
      'An excerpt\nfrom the source edited.\n',
    ],
    [
      'emphasis across a wrap',
      'Keep *the excerpt\nshort* here.\n',
      'Keep *the excerpt\nshort* here edited.\n',
    ],
    [
      'a quotation',
      '> An excerpt\n> from the source.\n',
      '> An excerpt\n> from the source edited.\n',
    ],
    [
      // Continuation lines are written unindented, so only those round-trip.
      'a list item',
      '- An excerpt\nfrom the source.\n',
      '- An excerpt\nfrom the source edited.\n',
    ],
  ])(
    'keeps the soft breaks of %s through an edit',
    (_name, source, expected) => {
      expect(checkMarkdownRoundTrip(source).ok).toBe(true);
      editor = mountMarkdown(source);

      editTextNodes(editor, (text) =>
        text.endsWith('.') ? `${text.slice(0, -1)} edited.` : null,
      );

      expect(hasHardBreak(editor.getJSON())).toBe(false);
      expect(serialize(editor, source)).toEqual({
        markdown: expected,
        exact: true,
      });
    },
  );

  it('keeps a hard break a hard break through an edit', () => {
    const source = 'An excerpt  \nfrom the source,\nwrapped.\n';
    expect(checkMarkdownRoundTrip(source).ok).toBe(true);
    editor = mountMarkdown(source);

    editTextNodes(editor, (text) => text.replace('wrapped.', 'wrapped again.'));

    expect(serialize(editor, source)).toEqual({
      markdown: 'An excerpt  \nfrom the source,\nwrapped again.\n',
      exact: true,
    });
  });

  it('writes a typed hard break as a hard break', () => {
    const source = 'An excerpt\nfrom the source.\n';
    editor = mountMarkdown(source);

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.setHardBreak();
    editor.commands.insertContent('More.');

    expect(serialize(editor, source).markdown).toBe(
      'An excerpt\nfrom the source.  \nMore.\n',
    );
  });

  it('reads a backslash hard break as a hard break', () => {
    // Written back with two spaces, so such a source opens as raw markdown,
    // where its bytes are kept.
    const result = checkMarkdownRoundTrip('An excerpt\\\nfrom the source.\n');
    expect(result).toMatchObject({
      ok: false,
      reason: 'not-identical',
      serialized: 'An excerpt  \nfrom the source.\n',
    });
    expect(hasHardBreak(result.doc ?? {})).toBe(true);
  });

  it('keeps soft breaks in a slice copied from the editor and pasted', () => {
    const source = 'An excerpt\nfrom the source.\n';
    editor = mountMarkdown(source);
    const { view } = editor;
    const end = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection({ from: 1, to: end });
    const { dom } = view.serializeForClipboard(
      editor.state.selection.content(),
    );

    editor.commands.setTextSelection(end);
    // jsdom has no ClipboardEvent, which pasteHTML otherwise constructs.
    view.pasteHTML(dom.innerHTML, new Event('paste') as ClipboardEvent);

    expect(hasHardBreak(editor.getJSON())).toBe(false);
    expect(serialize(editor, source).markdown).toBe(
      'An excerpt\nfrom the source.An excerpt\nfrom the source.\n',
    );
  });

  it('still collapses the newlines of external HTML', () => {
    editor = mountMarkdown('Text.\n');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.view.pasteHTML(
      '<p>Pasted\nfrom a page</p>',
      new Event('paste') as ClipboardEvent,
    );

    expect(editor.getJSON()).toEqual(parseMarkdown('Text.Pasted from a page'));
  });

  it('is part of the markdown extension set', () => {
    expect(
      createMarkdownExtensions().map((extension) => extension.name),
    ).toContain('markdownSoftBreaks');
  });
});
