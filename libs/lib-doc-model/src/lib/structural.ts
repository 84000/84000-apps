import type { Node } from '@tiptap/pm/model';

/** Whether a node is a paragraph carrying no attributes a row would save. */
export const isPlainParagraph = (node: Node): boolean =>
  node.type.name === 'paragraph' &&
  !node.attrs.textAlign &&
  !node.attrs.wordBreak;

/**
 * Whether a node is a paragraph that only wraps its parent's text.
 *
 * The loader wraps the text of a passage, a list item and a table cell in a
 * paragraph that shares the wrapper's uuid, because the schema requires one
 * there and no annotation describes it. Such a paragraph has no row of its
 * own. Once it carries an alignment or a word break it is a paragraph in its
 * own right, and needs its own uuid to be saved.
 *
 * `ownerUuid` is the uuid of the node the paragraph wraps: its parent's, or
 * the passage's for a top-level paragraph in a per-passage document.
 */
export const isStructuralParagraph = (
  node: Node,
  ownerUuid: string | null | undefined,
): boolean =>
  !!ownerUuid && node.attrs.uuid === ownerUuid && isPlainParagraph(node);
