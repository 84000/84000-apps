import { Transformer } from './transformer';

export const italic: Transformer = ({ block, annotation }) => {
  const currentContent = block.content || [];
  const newContent: typeof currentContent = [];

  const { start, end } = annotation;
  let annotationLen = end - start;
  let cursor = 0;

  currentContent.forEach((item) => {
    const lastCursor = cursor;
    cursor += item.text?.length || 0;
    const text = item.text || '';

    if (lastCursor < start || lastCursor > end || !text) {
      return;
    }

    if (lastCursor >= start && cursor <= end) {
      newContent.push({
        ...item,
        text,
        marks: [...(item.marks || []), { type: 'italic' }],
      });
      annotationLen -= text.length;
      return;
    }

    const startIdx = lastCursor - start;
    const endIdx = Math.min(startIdx + annotationLen, text.length);
    const italicText = text.slice(startIdx, endIdx);
    const regularText = text.slice(endIdx);

    newContent.push({
      ...item,
      text: italicText,
      marks: [...(item.marks || []), { type: 'italic' }],
    });

    if (regularText) {
      newContent.push({
        ...item,
        text: regularText,
      });
    }
  });

  block.content = newContent;

  return block;
};
