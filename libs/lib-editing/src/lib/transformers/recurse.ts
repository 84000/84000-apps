import { Annotation, AnnotationType } from '@eightyfourthousand/data-access';
import { TransformationContextWithCallback } from './transformer';
import { isInlineAnnotation } from './annotate';
import { TranslationEditorContentItem } from '../components';

/**
 * Walks the block tree looking for a node that can host the annotation and
 * fires the transform on it. Returns true when the transform ran.
 *
 * The normal match is a single node that fully contains the annotation range.
 * When an earlier annotation has already split the text at a boundary inside
 * this range, no single node contains it any more — in that case the fallback
 * applies inline transforms across the siblings that cover the range
 * (splitContent already splits every sibling and transforms each middle
 * segment, so the transform lands on all covered segments).
 */
export const recurse = (ctx: TransformationContextWithCallback): boolean => {
  if (trasformOnMatch(ctx)) {
    return true;
  }

  const { block } = ctx;
  for (const child of block.content || []) {
    if (
      recurse({
        ...ctx,
        parent: block,
        block: child,
      })
    ) {
      return true;
    }
  }

  // Post-order: children have all been tried, so the fallback fires at the
  // deepest block containing the range.
  return transformAcrossChildren(ctx);
};

const trasformOnMatch = (ctx: TransformationContextWithCallback) => {
  const { block, annotation, until = [], transform } = ctx;
  const type = block.type || 'unknown';
  if (
    block.attrs?.uuid !== annotation.uuid &&
    block.attrs?.start <= annotation.start &&
    block.attrs?.end >= annotation.end &&
    (!until.length || until.includes(type as AnnotationType))
  ) {
    transform?.(ctx);
    return true;
  }

  return false;
};

/**
 * Fallback for annotations that straddle a split boundary: when this block
 * contains the range and its inline children cover both ends, fire the
 * transform with this block as the parent. Only inline transforms may span
 * siblings; block transforms keep single-node matching semantics. Returns
 * false when the range crosses a block boundary (e.g. two lines of a
 * lineGroup) — that remains unplaceable.
 */
const transformAcrossChildren = (
  ctx: TransformationContextWithCallback,
): boolean => {
  const { block, annotation, until = [], transform } = ctx;

  if (
    !until.length ||
    !until.every((type) => isInlineAnnotation(type) || type === 'text')
  ) {
    return false;
  }

  const blockStart = block.attrs?.start;
  const blockEnd = block.attrs?.end;
  if (
    typeof blockStart !== 'number' ||
    typeof blockEnd !== 'number' ||
    blockStart > annotation.start ||
    blockEnd < annotation.end
  ) {
    return false;
  }

  const children = (block.content || []).filter(
    (child) =>
      child.attrs?.uuid !== annotation.uuid &&
      until.includes((child.type || 'unknown') as AnnotationType),
  );

  const coversStart = children.some(
    (child) =>
      (child.attrs?.start ?? 0) <= annotation.start &&
      (child.attrs?.end ?? 0) > annotation.start,
  );
  const coversEnd = children.some(
    (child) =>
      (child.attrs?.start ?? 0) < annotation.end &&
      (child.attrs?.end ?? 0) >= annotation.end,
  );
  if (!coversStart || !coversEnd) {
    return false;
  }

  const first = children.find(
    (child) => (child.attrs?.end ?? 0) > annotation.start,
  );
  if (!first) {
    return false;
  }

  transform?.({ ...ctx, parent: block, block: first });
  return true;
};

/**
 * Marks an annotation that no node could host: warns loudly and flips
 * `validated` so annotateBlock flags the passage as invalid. Call from a
 * transformer when `recurse` returns false.
 */
export const markUnplaceable = (annotation: Annotation) => {
  console.warn(
    `annotation ${annotation.uuid} (${annotation.type}) at (${annotation.start}, ${annotation.end}) could not be attached to any node; dropped from render`,
  );
  annotation.validated = false;
};

export const recurseForType = ({
  block,
  until,
}: {
  block: TranslationEditorContentItem;
  until: AnnotationType;
}): TranslationEditorContentItem | undefined => {
  if (block.type === until) {
    return block;
  }

  for (const child of block.content || []) {
    const val = recurseForType({ block: child, until });
    if (val) {
      return val;
    }
  }
};

/**
 * Recursively searches a node tree to find the first text node that has marks applied.
 * Used in tests to verify that mark transformers (span, code, link, etc.) are working correctly.
 */
export const findTextNodeWithMarks = (
  node: TranslationEditorContentItem,
): TranslationEditorContentItem | null => {
  if (node.type === 'text' && node.marks && node.marks.length > 0) {
    return node;
  }
  if (node.content) {
    for (const child of node.content) {
      const found = findTextNodeWithMarks(child);
      if (found) return found;
    }
  }
  return null;
};
