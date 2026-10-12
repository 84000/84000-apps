/**
 * Whether an annotation's offsets fit content of `length` UTF-16 units: whole
 * numbers with `0 <= start <= end <= length`. Offsets are JavaScript string
 * indices, so `length` is `content.length`, not a code-point count.
 *
 * The one rule for every caller that decides whether a stored row is usable
 * (reading it into a document, moving it with an edit) and whether a row may
 * be written.
 */
export const annotationRangeFits = (
  start: unknown,
  end: unknown,
  length: number,
): boolean =>
  Number.isInteger(start) &&
  Number.isInteger(end) &&
  (start as number) >= 0 &&
  (start as number) <= (end as number) &&
  (end as number) <= length;
