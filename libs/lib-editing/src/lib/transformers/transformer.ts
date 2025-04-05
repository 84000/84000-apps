import { Annotation } from '@data-access';
import { BlockEditorContentItem } from '@design-system';
import { JSONContent } from '@tiptap/react';

export type TransformerProps = {
  block: BlockEditorContentItem;
  annotation: Annotation;
};

export type Transformer = (props: TransformerProps) => BlockEditorContentItem;

export const pass = ({ block }: TransformerProps) => block;

export const scan = ({
  block,
  annotation,
  transform,
}: TransformerProps & {
  transform: (item: JSONContent) => JSONContent;
}) => {
  // TODO: potentially handle nested/recursive content
  const currentContent = block.content || [];
  const newContent: typeof currentContent = [];

  const { start, end } = annotation;
  let annotationLen = end - start;
  let cursor = 0;

  currentContent.forEach((item) => {
    const currentCursor = cursor;
    const nextCursor = cursor + (item.text?.length || 0);
    const text = item.text || '';
    cursor = nextCursor;

    // do not transform if the current item doesn't overlap with the annotation
    if (nextCursor < start || currentCursor > end || !text) {
      newContent.push(item);
      return;
    }

    // if the current item is entirely within the annotation, transform it entirely
    if (currentCursor >= start && nextCursor <= end) {
      newContent.push(transform(item));
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

    if (!textToTransform) {
      return;
    }

    if (preText) {
      newContent.push({
        ...item,
        text: preText,
      });
    }

    newContent.push(
      transform({
        ...item,
        text: textToTransform,
      }),
    );

    if (endText) {
      newContent.push({
        ...item,
        text: endText,
      });
    }
  });

  block.content = newContent;

  return block;
};
