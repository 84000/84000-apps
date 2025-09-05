import { AnnotationType } from '@data-access';
import { isBlockAnnotation } from './annotate';
import { splitNode } from './split-node';
import { Transformer } from './transformer';
import { BlockEditorContentItem } from '@design-system';

export const splitBlock: Transformer = ({
  root,
  parent,
  block,
  annotation,
  transform,
}) => {
  if (!isBlockAnnotation((block.type || 'unknown') as AnnotationType)) {
    console.warn(
      `splitBlock transformer expects to find a block annotation, but found: ${block.attrs?.type}`,
    );
    return;
  }

  if (!parent?.content?.length) {
    console.warn(
      'splitBlock transformer expects to find a parent block for the block.',
    );
    return;
  }

  const blockIndex = parent.content.findIndex(
    (item) => item.attrs?.uuid === block.attrs?.uuid,
  );

  if (blockIndex === -1) {
    console.warn(
      'splitBlock transformer expects to find the block in its parent.',
    );
    return;
  }

  const annStart = annotation?.start ?? 0;
  const annEnd = annotation?.end ?? 0;

  if (annStart === annEnd) {
    console.warn(
      'splitBlock transformer expects to find an annotation with non-zero length.',
    );
    return;
  }

  const currentContent = block.content || [];
  const prefixContent: typeof currentContent = [];
  const midContent: typeof currentContent = [];
  const suffixContent: typeof currentContent = [];

  for (const item of currentContent) {
    const { prefix, middle, suffix } = splitNode(item, annStart, annEnd);
    prefixContent.push(...prefix);
    midContent.push(...middle);
    suffixContent.push(...suffix);
  }

  const newBlocks: BlockEditorContentItem[] = [];
  if (prefixContent.length) {
    newBlocks.push({
      ...block,
      content: prefixContent,
      attrs: {
        ...block.attrs,
        start: prefixContent[0].attrs?.start ?? 0,
        end: prefixContent[prefixContent.length - 1].attrs?.end ?? 0,
      },
    });
  }

  if (midContent.length) {
    const newBlock: BlockEditorContentItem = {
      ...block,
      type: annotation.type,
      content: midContent,
      attrs: {
        ...block.attrs,
        start: midContent[0].attrs?.start ?? annStart,
        end: midContent[midContent.length - 1].attrs?.end ?? annEnd,
        uuid: annotation.uuid,
      },
    };
    transform?.({
      root,
      parent,
      block: newBlock,
      annotation,
    });
    newBlocks.push(newBlock);
  }

  if (suffixContent.length) {
    newBlocks.push({
      ...block,
      content: suffixContent,
      attrs: {
        ...block.attrs,
        start: suffixContent[0].attrs?.start ?? 0,
        end: suffixContent[suffixContent.length - 1].attrs?.end ?? 0,
      },
    });
  }

  parent.content.splice(blockIndex, 1, ...newBlocks);
};
