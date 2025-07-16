import { AnnotationType } from '@data-access';
import { isInlineAnnotation } from './annotate';
import { Transformer } from './transformer';
import { splitNode } from './split-node';

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

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, annStartAbs, annEndAbs);

    // Transform only the 'middle' segments (those inside the annotation)
    for (const midItem of middle) {
      transform?.({
        root,
        parent,
        block: midItem,
        annotation,
      });
      newContent.push(midItem);
    }
    newContent.push(...prefix);
    newContent.push(...suffix);
  }

  // Sort by start offset to maintain order, as segments may be pushed in any order
  newContent.sort((a, b) => (a.attrs?.start ?? 0) - (b.attrs?.start ?? 0));
  parent.content = newContent;
};
