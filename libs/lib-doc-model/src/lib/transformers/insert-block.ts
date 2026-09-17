import { AnnotationType } from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { insert } from './split-insert';
import { filterAttrs } from './util';
import { tohAttrs } from '../annotation-attrs';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

/**
 * The block types that may legitimately span no characters: a line or a
 * paragraph whose only children are inline atoms, such as the folio reference
 * that opens a translation.
 *
 * `lineGroup` is deliberately absent. A group is a container of lines, so it
 * is never the block that holds the atom — the line inside it is — and its
 * `line+` content means an empty group could not be built anyway.
 */
const CARRIER_TYPES: AnnotationType[] = ['line', 'paragraph'];

/**
 * Places a zero-length block annotation as a new empty sibling at its
 * position.
 *
 * Its counterpart `splitBlock` divides a block at the annotation's boundaries,
 * which a zero-length range cannot do — there is nothing to carve out. The new
 * block is inserted into the parent instead, where `insert`'s stable sort keeps
 * it ahead of the sibling beginning at the same position. The inline
 * annotations sharing that position attach to it afterwards, because
 * `blockFromPassage` orders block annotations before inline ones at the same
 * point.
 */
export const insertBlockAt: Transformer = ({ parent, block, annotation }) => {
  const { start, end, type, uuid } = annotation;

  if (start !== end) {
    console.warn(
      'insertBlockAt: transformer expects to find an annotation with zero length.',
    );
    return;
  }

  if (!parent?.content?.length) {
    console.warn(
      'insertBlockAt: transformer expects to find a parent block for the block.',
    );
    return;
  }

  // Only a position that coincides with a sibling boundary can host an empty
  // block. A position inside a block's text would need that block split, and a
  // zero-length range gives `splitBlock` nothing to split on.
  const blockStart = block.attrs?.start ?? 0;
  const blockEnd = block.attrs?.end ?? 0;
  if (start > blockStart && start < blockEnd) {
    console.warn(
      `insertBlockAt: ${uuid} (${type}) at ${start} falls inside ${block.attrs?.uuid} (${blockStart}, ${blockEnd}); no block inserted.`,
    );
    return;
  }

  const newBlock: TranslationEditorContentItem = {
    type,
    attrs: {
      ...filterAttrs(block.attrs),
      ...tohAttrs(annotation),
      start,
      end,
      uuid,
    },
    content: [],
  };

  parent.content = insert(newBlock, parent.content);
};

/**
 * The zero-length block that an inline annotation at `position` belongs in, if
 * one has been placed there — see `insertBlockAt`.
 *
 * Searched depth first, deepest match winning, so a mention lands in the line
 * rather than in any zero-length block that happens to contain it.
 */
export const zeroLengthCarrier = (
  block: TranslationEditorContentItem,
  position: number,
): TranslationEditorContentItem | undefined => {
  for (const child of block.content || []) {
    const nested = zeroLengthCarrier(child, position);
    if (nested) {
      return nested;
    }

    if (
      CARRIER_TYPES.includes((child.type || 'unknown') as AnnotationType) &&
      child.attrs?.start === position &&
      child.attrs?.end === position
    ) {
      return child;
    }
  }

  return undefined;
};
