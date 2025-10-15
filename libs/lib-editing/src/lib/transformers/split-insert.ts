import { Transformer } from './transformer';
import { splitNode } from './split-node';
import type { TranslationEditorContentItem } from '../components/editor';
import { filterAttrs } from './util';

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

export const splitAndInsert: Transformer = (ctx) => {
  const { root, parent, block, annotation, transform } = ctx;
  const { start, end } = annotation;

  if (start !== end) {
    console.warn(
      'splitAndInsert: transformer expects to find an annotation with zero-length (insertion point).',
    );
    return;
  }

  if (!parent || !parent.content) {
    console.warn(
      'splitAndInsert: transformer expects to find a parent block with content.',
    );
    return;
  }

  const newBlock: TranslationEditorContentItem = {
    type: annotation.type,
    attrs: {
      ...filterAttrs(block.attrs),
      start,
      end,
    },
  };
  transform?.({ root, parent, block: newBlock, annotation });

  if (start <= block.attrs?.start || start >= block.attrs?.end) {
    parent.content = insert(newBlock, parent.content || []);
    return;
  }

  const currentContent = parent.content || [];
  const newContent = [];

  let wasInserted = false;
  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, start, end);

    newContent.push(...prefix);
    for (const midItem of middle) {
      newContent.push(midItem);
      if (!wasInserted && midItem.attrs?.end === start) {
        newContent.push(newBlock);
        wasInserted = true;
      }
    }

    if (!wasInserted) {
      newContent.push(newBlock);
      wasInserted = true;
    }
    newContent.push(...suffix);
  }

  parent.content = sort(newContent);
};
