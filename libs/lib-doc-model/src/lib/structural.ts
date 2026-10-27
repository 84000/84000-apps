import type { Node } from '@tiptap/pm/model';
import { tohFromAttrs } from './annotation-attrs';

/**
 * Whether a node is a paragraph carrying nothing a row of its own would save:
 * no alignment or word break, and not a line holding only inline atoms (such
 * as a folio reference on its own line), whose row is what keeps the break.
 */
export const isPlainParagraph = (node: Node): boolean =>
  node.type.name === 'paragraph' &&
  !node.attrs.textAlign &&
  !node.attrs.wordBreak &&
  !(node.childCount > 0 && !node.textContent);

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

/**
 * Whether a paragraph wrapped into a new `wrapper` takes the wrapper's uuid.
 *
 * A list item holds one paragraph for its text and nothing describes it. When
 * the editor wraps an existing paragraph in a new list item, the paragraph
 * arrives with a uuid of its own, which would be saved as a paragraph row
 * inside the item. A blockquote is different: its paragraphs are stored. A
 * paragraph scoped to some Tohoku texts keeps its row too, since the scope
 * is saved on it and the item carries none.
 */
export const takesWrapperUuid = (wrapper: Node, paragraph: Node): boolean =>
  wrapper.type.name === 'listItem' &&
  tohFromAttrs(paragraph.attrs).length === 0;
