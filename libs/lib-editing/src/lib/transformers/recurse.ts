import { AnnotationType } from '@data-access';
import { TransformationContextWithCallback, Transformer } from './transformer';
import { TranslationEditorContentItem } from '../components';

export const recurse: Transformer = (ctx) => {
  if (trasformOnMatch(ctx)) {
    return;
  }

  const { block } = ctx;
  for (const child of block.content || []) {
    if (trasformOnMatch({ ...ctx, parent: block, block: child })) {
      return;
    }

    recurse({
      ...ctx,
      parent: block,
      block: child,
    });
  }
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
