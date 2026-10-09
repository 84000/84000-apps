import { Extension, type Extensions } from '@tiptap/core';
import { DOMParser, type ParseOptions } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import {
  renderTableToMarkdown,
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table';

/**
 * Tiptap's table serializer wraps its output in a newline on each side, which
 * the block joiner then turns into two blank lines around every table. Trim
 * them so a table separated by one blank line serializes the way it loaded.
 */
const MarkdownTable = Table.extend({
  renderMarkdown: (node, helpers) =>
    renderTableToMarkdown(node, helpers).replace(/^\n/, '').replace(/\n$/, ''),
});

/**
 * Keeps a backslash-escaped character (`\*`) as text; upstream drops it.
 * Parse-only, so it adds nothing to the schema.
 */
const MarkdownEscape = Extension.create({
  name: 'markdownEscape',
  markdownTokenName: 'escape',
  parseMarkdown: (token) => ({ type: 'text', text: token.text ?? '' }),
});

/** Asks for every newline in the parsed DOM to be kept as text. */
const keepingNewlines = (options: ParseOptions = {}): ParseOptions =>
  options.preserveWhitespace === true
    ? { ...options, preserveWhitespace: 'full' }
    : options;

/**
 * A DOM parser that keeps newlines in text where ProseMirror's default turns
 * them into hard breaks: when it re-reads the DOM after an edit, and when it
 * pastes a slice copied from a ProseMirror editor.
 */
class NewlinePreservingParser extends DOMParser {
  override parse(dom: globalThis.Node, options?: ParseOptions) {
    return super.parse(dom, keepingNewlines(options));
  }

  override parseSlice(dom: globalThis.Node, options?: ParseOptions) {
    return super.parseSlice(dom, keepingNewlines(options));
  }
}

/**
 * Keeps a source's soft line breaks, which parse as newlines in text, when a
 * paragraph is edited. ProseMirror re-reads an edited paragraph from the DOM
 * with `preserveWhitespace: true`, which turns each newline into a hard break,
 * so one keystroke would rewrite every wrap in the paragraph as `  \n`. The
 * wraps are kept rather than reflowed, so an edit changes only its own lines.
 * External HTML still collapses its newlines; a typed hard break is a `<br>`.
 */
const MarkdownSoftBreaks = Extension.create({
  name: 'markdownSoftBreaks',
  addProseMirrorPlugins() {
    const { schema } = this.editor;
    const parser = new NewlinePreservingParser(
      schema,
      DOMParser.fromSchema(schema).rules,
    );
    return [
      new Plugin({
        key: new PluginKey('markdownSoftBreaks'),
        props: { domParser: parser },
      }),
    ];
  },
});

/**
 * The markdown-safe extension subset for editing policies: stock `@tiptap/*`
 * extensions only. Nothing from the translation editor -- its extensions add
 * uuids and translation attributes that markdown has no syntax for.
 *
 * Off on purpose:
 * - `underline`: markdown has no underline syntax.
 * - `trailingNode`: it appends an empty paragraph to a document that ends in
 *   a list, table or quote as soon as an editor mounts, which would make an
 *   untouched policy read as changed.
 *
 * A change here changes which documents round-trip byte for byte: rerun the
 * markdown specs (`markdown-codec.spec.ts` and any corpus spec) and update
 * their expectations deliberately.
 */
export const createMarkdownExtensions = (): Extensions => [
  StarterKit.configure({
    underline: false,
    trailingNode: false,
    link: { openOnClick: false, autolink: false },
  }),
  MarkdownTable.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  MarkdownEscape,
  MarkdownSoftBreaks,
];
