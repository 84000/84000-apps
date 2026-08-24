import { Schema } from '@tiptap/pm/model';

/**
 * A minimal schema for the doc-model tests.
 *
 * Deliberately not the editor's or the SSR schema: the model takes a schema as
 * a parameter, so building one here from `prosemirror-model` directly both
 * keeps the tests free of `lib-editing` — which depends on this package, not
 * the reverse — and demonstrates that any schema works.
 *
 * It carries `uuid`, `textAlign` and `wordBreak` on paragraphs because the
 * exporters read those when materializing a row.
 */
export const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: {
        uuid: { default: null },
        textAlign: { default: null },
        wordBreak: { default: null },
      },
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
});

/** A paragraph node, as ProseMirror JSON. */
export const para = (text: string, uuid: string) => ({
  type: 'paragraph',
  attrs: { uuid, textAlign: null, wordBreak: null },
  content: text ? [{ type: 'text', text }] : [],
});

/** The text of each paragraph in a document, as JSON. */
export const paraTexts = (json: {
  content?: { content?: { text?: string }[] }[];
}): string[] =>
  (json.content ?? []).map((node) =>
    (node.content ?? []).map((child) => child.text ?? '').join(''),
  );
