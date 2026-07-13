import { AnnotationType } from '@eightyfourthousand/data-access';
import { recurse } from './recurse';
import { Transformer } from './transformer';
import { TranslationEditorContentItem } from '../components';

const HOST_TYPES: AnnotationType[] = [
  'blockquote',
  'heading',
  'lineGroup',
  'paragraph',
];

/**
 * A leading-space is a zero-width annotation marking the point that should be
 * preceded by extra vertical space. It must land on the host block that *begins*
 * at that point — the block the space precedes — not the block that ends there.
 *
 * `recurse` matches the first block whose range contains the annotation, so at a
 * boundary between two paragraphs (e.g. a leading-space at 40 between paragraphs
 * (0, 40) and (40, 80)) it would attach to the preceding paragraph, which
 * renders no gap and round-trips back to the wrong position. Prefer the block
 * whose start equals the insertion point instead.
 */
const findInsertionBlock = (
  block: TranslationEditorContentItem,
  position: number,
): TranslationEditorContentItem | undefined => {
  for (const child of block.content || []) {
    if (
      HOST_TYPES.includes((child.type || 'unknown') as AnnotationType) &&
      child.attrs?.start === position
    ) {
      return child;
    }

    const nested = findInsertionBlock(child, position);
    if (nested) {
      return nested;
    }
  }

  return undefined;
};

export const leadingSpace: Transformer = (ctx) => {
  const leadingSpaceUuid = ctx.annotation.uuid;
  const applyLeadingSpace = (block: TranslationEditorContentItem) => {
    block.attrs = {
      ...block.attrs,
      hasLeadingSpace: true,
      leadingSpaceUuid,
    };
  };

  const insertionBlock = findInsertionBlock(ctx.block, ctx.annotation.start);
  if (insertionBlock) {
    applyLeadingSpace(insertionBlock);
    return;
  }

  // Fallback: no host block begins exactly at the insertion point (e.g. the
  // annotation sits inside a block's text). Attach to the containing block.
  recurse({
    ...ctx,
    until: HOST_TYPES,
    transform: ({ block }) => applyLeadingSpace(block),
  });
};
