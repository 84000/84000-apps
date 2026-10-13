import { ANNOTATIONS_TO_IGNORE, annotationRangeFits } from '../../types';
import type { ExistingAnnotationRow } from './diff';

/**
 * Maps offsets in `before` onto `after` across the one region where they
 * differ: the longest common prefix and suffix stay put, an offset before the
 * region keeps its place, one after it moves by the change in length, and
 * one inside it goes to the region's start or end. Exact for a single edit
 * away from repeated characters; otherwise approximate, but in range.
 */
export const offsetMap = (before: string, after: string) => {
  const shorter = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shorter && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }
  const delta = after.length - before.length;
  return (offset: number, side: 'start' | 'end') => {
    if (offset <= prefix) return offset;
    if (offset >= before.length - suffix) return offset + delta;
    return side === 'start' ? prefix : after.length - suffix;
  };
};

const ignored = new Set<string>(ANNOTATIONS_TO_IGNORE);

/**
 * Moves the stored rows of types editors never load with their passage's
 * text, since no client sends them back. A row is moved only when it fit the
 * old text, fits the new, and keeps a non-zero length; otherwise it is left
 * as stored, never deleted, with a warning. Collapsing is no proof its text
 * went: where a character repeats, the changed region is ambiguous.
 */
export const remapIgnoredRows = ({
  existing,
  storedContent,
  content,
  skip,
}: {
  existing: ExistingAnnotationRow[];
  /** Stored content of each saved passage that already exists. */
  storedContent: Map<string, string>;
  /** Content each saved passage will have. */
  content: Map<string, string>;
  /** Rows the caller sent, keeps as stored, or whose passage is incomplete. */
  skip: (row: ExistingAnnotationRow) => boolean;
}): { moved: ExistingAnnotationRow[]; warnings: string[] } => {
  const moved: ExistingAnnotationRow[] = [];
  const warnings: string[] = [];
  const maps = new Map<string, ReturnType<typeof offsetMap>>();

  existing.forEach((row) => {
    if (!ignored.has(row.type) || skip(row)) return;
    const before = storedContent.get(row.passage_uuid);
    const after = content.get(row.passage_uuid);
    if (before === undefined || after === undefined || before === after) {
      return;
    }
    const leftAsStored = (why: string) =>
      warnings.push(
        `Annotation ${row.uuid} (${row.type}) on passage ${row.passage_uuid} was left as stored: ${why}`,
      );
    if (!annotationRangeFits(row.start, row.end, before.length)) {
      leftAsStored('it was already out of range');
      return;
    }
    let map = maps.get(row.passage_uuid);
    if (!map) {
      map = offsetMap(before, after);
      maps.set(row.passage_uuid, map);
    }
    const start = map(row.start, 'start');
    const end = map(row.end, 'end');
    if (!annotationRangeFits(start, end, after.length)) {
      leftAsStored('it would not fit the new text');
      return;
    }
    if (row.end > row.start && start === end) {
      leftAsStored('its text could not be placed in the new text');
      return;
    }
    if (start === row.start && end === row.end) return;
    moved.push({ ...row, start, end });
  });

  return { moved, warnings };
};
