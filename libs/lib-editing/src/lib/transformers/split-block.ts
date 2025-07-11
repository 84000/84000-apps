import { AnnotationType } from '@data-access';
import { isBlockAnnotation } from './annotate';
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

  const { start = 0, end = 0 } = annotation || {};
  const currentContent = block.content || [];
  const prefixContent: typeof currentContent = [];
  const midContent: typeof currentContent = [];
  const suffixContent: typeof currentContent = [];

  currentContent.forEach((item) => {
    const itemStart = item.attrs?.start || 0;
    const itemEnd = item.attrs?.end || 0;

    if (itemEnd < start) {
      prefixContent.push(item);
      return;
    }

    if (itemStart > end) {
      suffixContent.push(item);
      return;
    }

    const itemText = item.text || '';

    const targetStart = Math.max(start - itemStart, 0);
    const targetEnd = Math.min(targetStart + (end - start), itemText.length);
    const preText = itemText.slice(0, targetStart);
    if (preText) {
      prefixContent.push({
        ...item,
        text: preText,
        attrs: {
          ...item.attrs,
          start: itemStart,
          end: itemStart + preText.length,
        },
      });
    }

    const midText = itemText.slice(targetStart, targetEnd);

    if (midText) {
      midContent.push({
        ...item,
        text: midText,
        attrs: {
          ...item.attrs,
          start: targetStart,
          end: targetStart + midText.length,
        },
      });
    }

    const postStart = targetStart + midText.length + 1;
    const postText = itemText.slice(postStart);

    if (postText) {
      suffixContent.push({
        ...item,
        text: postText,
        attrs: {
          ...item.attrs,
          start: postStart,
          end: postStart + postText.length,
        },
      });
    }
  });

  const newBlocks: BlockEditorContentItem[] = [];
  if (prefixContent.length) {
    newBlocks.push({
      ...block,
      content: prefixContent,
      attrs: {
        ...block.attrs,
        start: prefixContent[0].attrs?.start || 0,
        end: prefixContent[prefixContent.length - 1].attrs?.end || 0,
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
        start: midContent[0].attrs?.start || 0,
        end: midContent[midContent.length - 1].attrs?.end || 0,
      },
    };
    transform?.({
      block: newBlock,
      annotation,
      parent,
      root,
    });
    newBlocks.push(newBlock);
  }

  if (suffixContent.length) {
    newBlocks.push({
      ...block,
      content: suffixContent,
      attrs: {
        ...block.attrs,
        start: suffixContent[0].attrs?.start || 0,
        end: suffixContent[suffixContent.length - 1].attrs?.end || 0,
      },
    });
  }

  parent.content.splice(blockIndex, 1, ...newBlocks);
};
