export type TranslationMark = {
  type: string;
  attrs?: {
    start?: number;
    end?: number;
    [key: string]: unknown;
  };
};

/**
 * Redistributes a node's marks onto one of its split segments [start, end].
 *
 * Marks without positional attrs (link, glossaryInstance, endNoteLink, etc. —
 * only span marks carry start/end) cover the whole original node, so they are
 * kept on every segment untouched. Ranged marks are kept only when they
 * actually overlap the segment, then clamped to it; a mark that lies entirely
 * outside the segment must be dropped, never clamped into an inverted
 * (start > end) range.
 */
export const splitMarks = ({
  marks,
  start,
  end,
  isLast = false,
}: {
  marks?: TranslationMark[];
  start: number;
  end: number;
  /**
   * True when this is the final segment of the node, so a zero-width mark
   * sitting exactly on the node's end boundary has a segment to land on.
   */
  isLast?: boolean;
}) => {
  if (!marks) {
    return;
  }

  return marks
    .filter((mark) => {
      const markStart = mark.attrs?.start;
      const markEnd = mark.attrs?.end;

      if (typeof markStart !== 'number' || typeof markEnd !== 'number') {
        return true;
      }

      // Zero-width marks attach to exactly one segment: half-open bounds so a
      // boundary position lands on the following segment, except at the very
      // end of the node where the last segment claims it.
      if (markStart === markEnd) {
        return (
          markStart >= start && (markStart < end || (isLast && markStart === end))
        );
      }

      return markStart < end && markEnd > start;
    })
    .map((mark) => {
      const markStart = mark.attrs?.start;
      const markEnd = mark.attrs?.end;

      if (typeof markStart !== 'number' || typeof markEnd !== 'number') {
        return mark;
      }

      return {
        ...mark,
        attrs: {
          ...mark.attrs,
          start: Math.max(markStart, start),
          end: Math.min(markEnd, end),
        },
      };
    });
};
