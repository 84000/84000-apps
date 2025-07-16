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

  // Use annotation start and end as exclusive for normal, but support insertions (start === end).
  const annStartAbs = annotation.start;
  const annEndAbs = annotation.end;

  const currentContent = parent.content || [];
  const newContent = [];

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, annStartAbs, annEndAbs);

    // For insertion annotation, middle is a node with text: "" and start == end.
    // Always pass middle segments (including empty text for insertions) to transform.
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

  // Sort by start offset to maintain order
  newContent.sort((a, b) => (a.attrs?.start ?? 0) - (b.attrs?.start ?? 0));
  parent.content = newContent;
};
