import type { JSONContent } from '@tiptap/core';
import type { LabelChange } from './types';

/** The block an otherwise empty passage holds. */
export const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' };

/**
 * Collapse repeated label changes for one passage into a single change.
 *
 * An operation that removes and inserts in the same breath renumbers the run
 * twice, so a passage can appear in both batches. Undo applies each change's
 * `from` independently, so a passage listed twice would be restored to the
 * intermediate label rather than the one it started with: keep the first
 * `from` and the last `to`, and drop whatever ends where it began.
 */
export const collapseLabelChanges = (changes: LabelChange[]): LabelChange[] => {
  const merged = new Map<string, LabelChange>();
  changes.forEach((change) => {
    const seen = merged.get(change.uuid);
    if (seen) seen.to = change.to;
    else merged.set(change.uuid, { ...change });
  });
  return [...merged.values()].filter((change) => change.from !== change.to);
};

/** An empty paragraph carries no text and no structure worth keeping. */
export const isBlankParagraph = (node: JSONContent | undefined): boolean =>
  !!node && node.type === 'paragraph' && !node.content?.length;

/**
 * Trim a blank paragraph from either side of a merge seam.
 *
 * Only a paragraph, and only an empty one: an empty heading or line group is
 * structure a merge has no business discarding, and a paragraph holding even
 * whitespace is content. At most one side is trimmed, so merging two blank
 * passages still leaves a block to hold the caret.
 */
export const joinAtSeam = (
  head: JSONContent[],
  tail: JSONContent[],
): [JSONContent[], JSONContent[]] => {
  if (tail.length && isBlankParagraph(tail[0])) {
    return [head, tail.slice(1)];
  }
  if (head.length && isBlankParagraph(head[head.length - 1])) {
    return [head.slice(0, -1), tail];
  }
  return [head, tail];
};
