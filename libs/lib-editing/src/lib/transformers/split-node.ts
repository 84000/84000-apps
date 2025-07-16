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
  const itemEnd = item.attrs?.end ?? itemStart + (item.text?.length ?? 0);

  // If this node does not have a .text property (like a block/paragraph), treat as atomic
  if (typeof item.text !== 'string') {
    // If the whole item is before or after the range, put it in prefix or suffix
    if (itemEnd <= rangeStart) {
      return { prefix: [item], middle: [], suffix: [] };
    }
    if (itemStart >= rangeEnd) {
      return { prefix: [], middle: [], suffix: [item] };
    }
    // If it overlaps, treat the whole node as "middle"
    return { prefix: [], middle: [item], suffix: [] };
  }

  // If .text is present, split as before, but skip empty segments
  const text = item.text;
  const splits: SplitBlock = { prefix: [], middle: [], suffix: [] };

  const preLen = Math.max(rangeStart - itemStart, 0);
  const midLen = Math.max(
    Math.min(itemEnd, rangeEnd) - Math.max(itemStart, rangeStart),
    0,
  );
  const postLen = Math.max(itemEnd - Math.min(itemEnd, rangeEnd), 0);

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
  if (postLen > 0) {
    const postText = text.slice(preLen + midLen);
    if (postText) {
      splits.suffix.push({
        ...item,
        text: postText,
        attrs: {
          ...item.attrs,
          start: itemEnd - postText.length,
          end: itemEnd,
        },
      });
    }
  }

  return splits;
}
