import { BlockEditorContentItem } from '@design-system';

type SplitBlock = {
  prefix: BlockEditorContentItem[];
  middle: BlockEditorContentItem[];
  suffix: BlockEditorContentItem[];
};

/**
 * Splits a node (text or block) by an absolute annotation range.
 * Returns an object with arrays: prefix, middle, suffix.
 * Each array contains 0 or more items.
 * All returned nodes have correct absolute start/end.
 */
export function splitNode(
  item: BlockEditorContentItem,
  rangeStart: number,
  rangeEnd: number,
): SplitBlock {
  const itemStart = item.attrs?.start ?? 0;
  const text = item.text ?? '';
  // Inclusive end: the last character is at itemEnd - 1, so itemEnd should be itemStart + text.length - 1
  const itemEnd =
    typeof item.text === 'string'
      ? itemStart + text.length - 1
      : (item.attrs?.end ?? itemStart);

  // Non-text blocks: treat atomically
  if (typeof item.text !== 'string') {
    if (itemEnd < rangeStart) {
      return { prefix: [item], middle: [], suffix: [] };
    }
    if (itemStart > rangeEnd) {
      return { prefix: [], middle: [], suffix: [item] };
    }
    return { prefix: [], middle: [item], suffix: [] };
  }

  // Entirely before
  if (itemEnd < rangeStart) {
    return { prefix: [item], middle: [], suffix: [] };
  }
  // Entirely after
  if (itemStart > rangeEnd) {
    return { prefix: [], middle: [], suffix: [item] };
  }

  // Compute indices for slicing (inclusive)
  // preLen: up to (rangeStart - itemStart)
  // midLen: from (rangeStart - itemStart) to (rangeEnd - itemStart + 1)
  // postLen: after (rangeEnd - itemStart + 1)
  const preLen = Math.max(rangeStart - itemStart, 0);
  const midLen = Math.max(
    Math.min(itemEnd, rangeEnd) - Math.max(itemStart, rangeStart) + 1,
    0,
  );
  const postStartIdx = preLen + midLen;

  const splits: SplitBlock = { prefix: [], middle: [], suffix: [] };

  if (preLen > 0) {
    const preText = text.slice(0, preLen);
    if (preText) {
      splits.prefix.push({
        ...item,
        text: preText,
        attrs: {
          ...item.attrs,
          start: itemStart,
          end: itemStart + preText.length,
        },
      });
    }
  }

  if (midLen > 0) {
    const midText = text.slice(preLen, preLen + midLen);
    if (midText) {
      splits.middle.push({
        ...item,
        text: midText,
        attrs: {
          ...item.attrs,
          start: itemStart + preLen,
          end: itemStart + preLen + midText.length,
        },
      });
    }
  }

  if (postStartIdx < text.length) {
    const postText = text.slice(postStartIdx);
    if (postText) {
      splits.suffix.push({
        ...item,
        text: postText,
        attrs: {
          ...item.attrs,
          start: itemStart + postStartIdx,
          end: itemStart + text.length,
        },
      });
    }
  }

  return splits;
}
