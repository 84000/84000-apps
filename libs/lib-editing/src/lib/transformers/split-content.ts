import { AnnotationType } from '@data-access';
import { isInlineAnnotation } from './annotate';
import { Transformer } from './transformer';

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

  const currentContent = parent.content || [];
  const newContent: typeof currentContent = [];

  const { start, end } = annotation;
  let annotationLen = end - start;
  let cursor = parent.attrs?.start || 0;

  currentContent.forEach((item) => {
    const currentCursor = cursor;
    const nextCursor = cursor + (item.text?.length || 0);
    const text = item.text || '';
    cursor = nextCursor;

    item.attrs = {
      ...item.attrs,
      start: currentCursor,
      end: currentCursor + text.length,
    };

    // do not transform if the current item doesn't overlap with the annotation
    if (nextCursor < start || currentCursor > end || !text) {
      newContent.push(item);
      return;
    }

    // if the current item is entirely within the annotation, transform it entirely
    if (currentCursor >= start && nextCursor <= end) {
      transform?.({
        root,
        parent,
        block: item,
        annotation,
      });
      newContent.push(item);
      annotationLen -= text.length;
      return;
    }

    // otherwise the current item partially overlaps with the annotation, so
    // split it into up to three parts: before the annotation, the annotation,
    // and after the annotation
    const length = text.length;
    const preTextLen = Math.max(start - currentCursor, 0);
    const midTextLen = Math.min(length - preTextLen, annotationLen);

    const startIdx = preTextLen;
    const endIdx = startIdx + midTextLen;

    const preText = text.slice(0, startIdx);
    const textToTransform = text.slice(startIdx, endIdx);
    const endText = text.slice(endIdx);

    annotationLen -= textToTransform.length;

    if (preText) {
      newContent.push({
        ...item,
        text: preText,
        attrs: {
          ...item.attrs,
          start: currentCursor,
          end: currentCursor + preText.length,
        },
      });
    }

    const midTextStart = currentCursor + preText.length + 1;
    const midTextEnd = midTextStart + textToTransform.length;

    // insert if we have text to transform or it the annotation has
    // length 0, meaning it an endnote or similar.
    if (textToTransform.length || !annotationLen) {
      const nextItem = {
        ...item,
        text: textToTransform,
        attrs: {
          ...item.attrs,
          start: midTextStart,
          end: midTextEnd,
        },
      };
      transform?.({
        root,
        parent,
        block: nextItem,
        annotation,
      });

      newContent.push(nextItem);
    }

    if (endText) {
      newContent.push({
        ...item,
        text: endText,
        attrs: {
          ...item.attrs,
          start: midTextEnd,
          end: midTextEnd + endText.length,
        },
      });
    }
  });

  parent.content = newContent;
};
