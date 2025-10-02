import { AnnotationType } from '@data-access';
import { isInlineAnnotation } from './annotate';
import { Transformer } from './transformer';
import { splitNode } from './split-node';
import type { BlockEditorContentItem } from '../components/editor';
import { filterAttrs } from './util';

export const splitContent: Transformer = ({
  root,
  parent,
  block,
  annotation,
  transform,
}) => {
  if (!isInlineAnnotation(block.type as AnnotationType)) {
    console.warn(
      `splitContent: block type expects to find an inline annotation, but found: ${block.type}.`,
    );
    return;
  }

  if (!parent || !parent.content) {
    console.warn(
      'splitContent: transformer expects to find a parent block with content.',
    );
    return;
  }

  const annStartAbs = annotation.start;
  const annEndAbs = annotation.end;
  const currentContent = parent.content || [];
  const newContent = [];
  const attrs = filterAttrs(block.attrs);

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, annStartAbs, annEndAbs);

    newContent.push(...prefix);
    // Only transform the middle segments
    for (const midItem of middle) {
      transform?.({
        root,
        parent,
        block: midItem,
        annotation,
      });
      newContent.push(midItem);
    }
    newContent.push(...suffix);
  }

  if (annStartAbs === annEndAbs && annStartAbs === attrs?.end) {
    const newBlock: BlockEditorContentItem = {
      type: annotation.type,
      attrs: {
        ...attrs,
        start: annStartAbs,
        end: annEndAbs,
      },
    };
    transform?.({ root, parent, block: newBlock, annotation });
    newContent.push(newBlock);
  }

  newContent.sort((a, b) => (a.attrs?.start ?? 0) - (b.attrs?.start ?? 0));
  parent.content = newContent;
};
