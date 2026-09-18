import type { JSONContent } from '@tiptap/core';
import {
  DOMParser,
  DOMSerializer,
  type Node as PMNode,
  type Schema,
} from '@tiptap/pm/model';

/**
 * Marks one passage's blocks in the clipboard's HTML.
 *
 * Only the stack reads it. Anything else — the per-tab editor, another
 * application — sees a plain wrapper and takes the blocks inside, which is the
 * same flattening every other paste in the app does.
 */
const PASSAGE_BOUNDARY_ATTR = 'data-stack-passage-boundary';

/**
 * The clipboard's HTML for a run of whole passages.
 *
 * Serialized from the passage documents rather than from the selected DOM. A
 * row that is not being edited is drawn by the reader's SSR extensions, whose
 * markup the editor's own parse rules cannot read back, so anything taken from
 * the DOM loses every annotation it crosses.
 */
export const passagesToHTML = (schema: Schema, nodes: PMNode[]): string => {
  const serializer = DOMSerializer.fromSchema(schema);
  const container = document.createElement('div');

  nodes.forEach((node) => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute(PASSAGE_BOUNDARY_ATTR, '');
    wrapper.appendChild(serializer.serializeFragment(node.content));
    container.appendChild(wrapper);
  });

  return container.innerHTML;
};

/** The clipboard's plain text, passages separated as blocks are. */
export const passagesToText = (nodes: PMNode[]): string =>
  nodes
    .map((node) => node.content.textBetween(0, node.content.size, '\n\n'))
    .join('\n\n');

/**
 * The passages a pasted fragment of HTML describes, each as its blocks.
 *
 * HTML this module wrote carries its passage boundaries, so a run copied from
 * the stack pastes back as the same run. HTML from anywhere else has none, and
 * becomes a single passage — the blocks are known, the division into passages
 * is not, and inventing one would be worse than not.
 */
export const passagesFromHTML = (
  schema: Schema,
  html: string,
): JSONContent[][] => {
  if (!html.trim()) return [];
  const container = document.createElement('div');
  container.innerHTML = html;

  const parser = DOMParser.fromSchema(schema);
  const blocksOf = (element: Element): JSONContent[] =>
    (parser.parse(element, { preserveWhitespace: true }).toJSON().content ??
      []) as JSONContent[];

  const wrappers = container.querySelectorAll(`[${PASSAGE_BOUNDARY_ATTR}]`);
  const passages = wrappers.length
    ? [...wrappers].map(blocksOf)
    : [blocksOf(container)];

  return passages.filter((blocks) => blocks.length > 0);
};

/** A plain-text paste, as one passage of paragraphs. */
export const passagesFromText = (text: string): JSONContent[][] => {
  const blocks = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: part }],
    }));
  return blocks.length ? [blocks] : [];
};
