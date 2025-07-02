import { Transformer } from './transformer';

export const splitBlock: Transformer = ({ block, annotation, transform }) => {
  if (!block.parent?.content?.length) {
    console.warn(
      'splitBlock transformer expects to find a parent block for the block.',
    );
    return;
  }

  const blockType = block.type;
  if (!blockType) {
    console.warn('splitBlock transformer expects a block with a type.');
    return;
  }

  const currentContent = block.content || [];

  const prefixContent: typeof currentContent = [];
  const newContent: typeof currentContent = [];
  const suffixContent: typeof currentContent = [];

  const { start, end } = annotation || {};
  const { end: blockEnd } = block.attrs || {};

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

    // TODO: support deeply nested content
    const itemText = item.text || '';
    const preText = itemText.slice(0, Math.max(start - itemStart, 0));
    if (preText) {
      prefixContent.push({
        ...item,
        text: preText,
        attrs: {
          ...item.attrs,
          end: Math.max(itemStart + preText.length, item.attrs?.end || 0),
        },
      });
    }

    const midText = itemText.slice(
      Math.max(start - itemStart, 0),
      Math.min(itemText.length, end - itemStart),
    );

    if (midText) {
      newContent.push({
        ...item,
        text: midText,
        attrs: {
          ...item.attrs,
        },
      });
    }

    const postText = itemText.slice(Math.min(itemText.length, end - itemStart));

    if (postText) {
      suffixContent.push({
        ...item,
        text: postText,
        attrs: {
          ...item.attrs,
        },
      });
    }
  });

  block.content = prefixContent;
  if (!block.content.length) {
    block.parent.content = [];
  }

  if (newContent.length) {
    const newBlock = {
      type: blockType,
      attrs: {
        type: blockType,
        start: start,
        end: end,
      },
      content: newContent,
      parent: block.parent,
    };
    block.parent.content.push(...(transform?.(newBlock) || [newBlock]));
  }

  if (suffixContent.length) {
    const suffixStart = end + 1;
    block.parent.content.push({
      type: blockType,
      attrs: {
        type: blockType,
        start: suffixStart,
        end: blockEnd || suffixStart,
      },
      content: suffixContent,
      parent: block.parent,
    });
  }

  // trim leading and trailing whitespace from text content in split blocks.
  block.parent.content.forEach((item) => {
    if (!item.content?.length) {
      return;
    }

    const firstText = item.content[0]?.text || '';
    if (firstText) {
      item.content[0].text = firstText.trimStart();
    }

    const lastText = item.content[item.content.length - 1]?.text || '';
    if (lastText) {
      item.content[item.content.length - 1].text = lastText.trimEnd();
    }
  });
};
