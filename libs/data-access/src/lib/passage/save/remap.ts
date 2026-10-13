import { ANNOTATIONS_TO_IGNORE, annotationRangeFits } from '../../types';
import type { ExistingAnnotationRow } from './diff';

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Maps offsets in `before` onto `after` across the one region where they
 * differ, between their longest common prefix and suffix, kept to whole
 * characters. An offset outside the region maps exactly: before it, it keeps
 * its place; after it, it moves by the change in length. Text inserted where
 * a row starts goes before the row, and where one ends, after it. An offset
 * inside the region goes to the region's edge and is marked inexact: where
 * the text changed in several places, or a character repeats, where it
 * belongs cannot be told.
 */
export const offsetMap = (before: string, after: string) => {
  const shorter = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shorter && before[prefix] === after[prefix]) prefix++;
  if (prefix > 0 && isHigh(before.charCodeAt(prefix - 1))) prefix--;
  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }
  if (suffix > 0 && isLow(before.charCodeAt(before.length - suffix))) {
    suffix--;
  }
  const tail = before.length - suffix;
  const delta = after.length - before.length;
  return (
    offset: number,
    side: 'start' | 'end',
  ): { offset: number; exact: boolean } => {
    const shifted = { offset: offset + delta, exact: true };
    if (side === 'start' && offset >= tail) return shifted;
    if (offset <= prefix) return { offset, exact: true };
    if (offset >= tail) return shifted;
    return {
      offset: side === 'start' ? prefix : after.length - suffix,
      exact: false,
    };
  };
};

const ignored = new Set<string>(ANNOTATIONS_TO_IGNORE);

/**
 * Moves the stored rows of types editors never load with their passage's
 * text, since no client sends them back. A row is moved only when it fit the
 * old text, fits the new, and keeps a non-zero length; otherwise it is left
 * as stored, never deleted, with a warning. A row with an end inside the
 * changed region is moved only when it would not fit left as stored, and is
 * then clamped to the region's edge.
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
    const from = map(row.start, 'start');
    // A zero-length row stays one.
    const to = row.end === row.start ? from : map(row.end, 'end');
    if (
      !(from.exact && to.exact) &&
      annotationRangeFits(row.start, row.end, after.length)
    ) {
      leftAsStored('its text could not be placed exactly in the new text');
      return;
    }
    const start = from.offset;
    const end = to.offset;
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
