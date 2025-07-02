import { Annotation } from '@data-access';
import { BlockEditorContentWithParent } from './transformer';

export const sibling = ({
  block,
  annotation,
  transform,
}: {
  block: BlockEditorContentWithParent;
  annotation: Annotation;
  transform: (item: BlockEditorContentWithParent) => void;
}) => {
  if (!block.parent?.content?.length) {
    console.warn(
      'insert transformer expects to find a parent block with content.',
    );
    return;
  }

  const siblings = block.parent.content;
  const newSiblings: typeof siblings = [];
  const { start, end } = annotation || {};

  siblings.forEach((sibling) => {
    const siblingEnd = sibling.attrs?.end || 0;
    if (siblingEnd < start) {
      newSiblings.push(sibling);
    }

    const siblingStart = sibling.attrs?.start || 0;
    if (siblingStart > end) {
      newSiblings.push(sibling);
    }

    transform(sibling);
  });
};
