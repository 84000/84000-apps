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

export const splitContentAt: Transformer = (ctx) => {
  const { root, parent, annotation, transform } = ctx;
  const { start, end } = annotation;

  if (start !== end) {
    console.warn(
      'splitContentAt: transformer expects to find an annotation with zero-length (insertion point).',
    );
    return;
  }

  if (!parent || !parent.content) {
    console.warn(
      'splitContentAt: transformer expects to find a parent block with content.',
    );
    return;
  }

  const annotationEnd = end;
  const currentContent = parent.content || [];
  const newContent = [];

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, start, end);

    const lastPrefix = prefix.at(-1);
    const firstSuffix = suffix[0];

    if (annotationEnd === lastPrefix?.attrs?.end) {
      transform?.({ root, parent, block: lastPrefix, annotation });
    } else if (annotationEnd === firstSuffix?.attrs?.end) {
      transform?.({ root, parent, block: firstSuffix, annotation });
    }

    newContent.push(...prefix);
    newContent.push(...middle);
    newContent.push(...suffix);
  }

  parent.content = newContent;
};
