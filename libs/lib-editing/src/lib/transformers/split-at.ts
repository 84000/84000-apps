import { Transformer } from './transformer';
import { splitNode } from './split-node';
import type { TranslationEditorContentItem } from '../components/editor';

export const sort = (nodes: TranslationEditorContentItem[]) => {
  return nodes.sort((a, b) => (a.attrs?.start ?? 0) - (b.attrs?.start ?? 0));
};

export const insert = (
  node: TranslationEditorContentItem,
  nodes: TranslationEditorContentItem[],
) => {
  // unshift to prioritize new block when sorting
  nodes.unshift(node);
  return sort(nodes);
};

export const splitAt: Transformer = (ctx) => {
  const { root, parent, annotation, transform } = ctx;
  const { start, end } = annotation;

  if (start !== end) {
    console.warn(
      'splitAt: transformer expects to find an annotation with zero-length (insertion point).',
    );
    return;
  }

  if (!parent || !parent.content) {
    console.warn(
      'splitAt: transformer expects to find a parent block with content.',
    );
    return;
  }

  // transform?.({ root, parent, block: newBlock, annotation });

  const currentContent = parent.content || [];
  const newContent = [];

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, start, end);

    const lastPrefix = prefix.at(-1);
    const firstSuffix = suffix[0];

    if (lastPrefix) {
      transform?.({ root, parent, block: lastPrefix, annotation });
    } else if (firstSuffix) {
      transform?.({ root, parent, block: firstSuffix, annotation });
    } else {
      console.warn('splitAt: no content to transform for annotation', {
        annotation,
      });
      console.log(prefix, middle, suffix);
    }
    newContent.push(...prefix);
    newContent.push(...middle);
    newContent.push(...suffix);
  }

  parent.content = sort(newContent);
};
