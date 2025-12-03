import type { TranslationEditorContentItem } from '../components/editor';
import { splitMarks } from './split-marks';
import { filterAttrs } from './util';

type SplitBlock = {
  prefix: TranslationEditorContentItem[];
  middle: TranslationEditorContentItem[];
  suffix: TranslationEditorContentItem[];
};

/**
 * Splits a node (text or block) by an absolute annotation range.
 * Returns an object with arrays: prefix, middle, suffix.
 * Each array contains 0 or more items.
 * All returned nodes have correct absolute start/end.
 */
export function splitNode(
  item: TranslationEditorContentItem,
  rangeStart: number,
  rangeEnd: number,
): SplitBlock {
  const itemStart = item.attrs?.start ?? 0;
  const text = item.text ?? '';
  const itemEnd =
    typeof item.text === 'string'
      ? itemStart + text.length
      : (item.attrs?.end ?? itemStart);

  if (itemEnd <= rangeStart) {
    return { prefix: [item], middle: [], suffix: [] };
  }

  if (itemStart >= rangeEnd) {
    return { prefix: [], middle: [], suffix: [item] };
  }

  const preLen = Math.max(rangeStart - itemStart, 0);
  const midLen = Math.max(
    Math.min(itemEnd, rangeEnd) - Math.max(itemStart, rangeStart),
    0,
  );
  const postStartIdx = preLen + midLen;

  const splits: SplitBlock = { prefix: [], middle: [], suffix: [] };
  const attrs = filterAttrs(item.attrs);
  const marks = item.marks ? [...item.marks] : undefined;

  if (preLen > 0) {
    const preText = text.slice(0, preLen);
    if (preText) {
      const prefixStart = itemStart;
      const prefixEnd = prefixStart + preText.length;

      const prefix = {
        ...item,
        text: preText,
        attrs: {
          ...attrs,
          start: prefixStart,
          end: prefixEnd,
        },
      };

      const prefixMarks = splitMarks({
        marks,
        start: prefixStart,
        end: prefixEnd,
      });

      if (prefixMarks?.length) {
        prefix.marks = prefixMarks;
      }

      splits.prefix.push(prefix);
    }
  }

  if (midLen > 0) {
    const midText = text.slice(preLen, preLen + midLen);
    if (midText) {
      const midStart = itemStart + preLen;
      const midEnd = midStart + midText.length;

      const mid = {
        ...item,
        text: midText,
        attrs: {
          ...attrs,
          start: midStart,
          end: midEnd,
        },
      };

      const midMarks = splitMarks({
        marks,
        start: midStart,
        end: midEnd,
      });

      if (midMarks?.length) {
        mid.marks = midMarks;
      }

      splits.middle.push(mid);
    }
  }

  if (postStartIdx < text.length) {
    const postText = text.slice(postStartIdx);
    if (postText) {
      const postStart = itemStart + postStartIdx;
      const postEnd = postStart + postText.length;
      const post = {
        ...item,
        text: postText,
        attrs: {
          ...attrs,
          start: postStart,
          end: postEnd,
        },
      };

      const postMarks = splitMarks({
        marks,
        start: postStart,
        end: postEnd,
      });

      if (postMarks?.length) {
        post.marks = postMarks;
      }

      splits.suffix.push(post);
    }
  }

  return splits;
}
