import { Extension, type Extensions } from '@tiptap/core';
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
];
