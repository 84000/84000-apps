import { Transformer } from './transformer';
import { splitNode } from './split-node';
import { BlockEditorContentItem } from '@design-system';

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

  const newBlock: BlockEditorContentItem = {
    type: annotation.type,
    attrs: {
      ...block.attrs,
      start,
      end,
    },
  };
  transform?.({ root, parent, block: newBlock, annotation });

  if (start === block.attrs?.start) {
    parent.content.unshift(newBlock);
    return;
  }

  if (start === block.attrs?.end) {
    parent.content.push(newBlock);
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

  newContent.sort((a, b) => (a.attrs?.start ?? 0) - (b.attrs?.start ?? 0));
  parent.content = newContent;
};
