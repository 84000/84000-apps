import type { BibliographyRow } from '../types';

/** Where a row sits in its work's bibliography. */
export type BibliographyRowPlace = {
  /** 0 for a top-level heading or a headingless entry; one more per heading above. */
  depth: number;
  /** The reference label the readers show (`1`, `1.2`, `1.2.3`); `null` when none can be derived. */
  label: string | null;
};

const bySort = (a: BibliographyRow, b: BibliographyRow) => a.sort - b.sort;

/**
 * The depth and label of every row of one work, numbered as the
 * `show_bibliographies` and `bibliography_labels` RPCs number them:
 *
 * - headings are numbered among their sibling headings by `sort`, under their
 *   parent's label, starting from the top-level headings;
 * - entries are numbered among the entries under the same heading by `sort`,
 *   under that heading's label, or on their own when it has none;
 * - top-level entries come first among the root's children, so top-level
 *   headings are numbered after them.
 *
 * A heading the top level cannot reach (a cycle, or a parent that is not a
 * heading) gets no label, and neither do the entries under it, as no reader
 * shows them.
 */
export const outlineBibliography = (
  rows: readonly BibliographyRow[],
): Map<string, BibliographyRowPlace> => {
  const places = new Map<string, BibliographyRowPlace>();
  const sorted = [...rows].sort(bySort);

  const headingsUnder = new Map<string | null, BibliographyRow[]>();
  /** Each entry's 1-based position among the entries under its heading. */
  const entryPosition = new Map<string, number>();
  const entryCount = new Map<string | null, number>();
  sorted.forEach((row) => {
    if (row.isHeading) {
      headingsUnder.set(row.headingUuid, [
        ...(headingsUnder.get(row.headingUuid) ?? []),
        row,
      ]);
      return;
    }
    const position = (entryCount.get(row.headingUuid) ?? 0) + 1;
    entryCount.set(row.headingUuid, position);
    entryPosition.set(row.uuid, position);
  });

  const under = (
    parent: BibliographyRowPlace | undefined,
    position: number,
  ) => ({
    depth: parent ? parent.depth + 1 : 0,
    label: parent?.label ? `${parent.label}.${position}` : String(position),
  });

  const placeHeadings = (
    parentUuid: string | null,
    parent?: BibliographyRowPlace,
  ) => {
    const offset = parentUuid ? 0 : (entryCount.get(null) ?? 0);
    headingsUnder.get(parentUuid)?.forEach((heading, at) => {
      // Guards against a uuid listed twice, which would otherwise recurse forever.
      if (places.has(heading.uuid)) return;
      const place = under(parent, offset + at + 1);
      places.set(heading.uuid, place);
      placeHeadings(heading.uuid, place);
    });
  };
  placeHeadings(null);

  sorted.forEach((row) => {
    if (row.isHeading) {
      if (!places.has(row.uuid))
        places.set(row.uuid, { depth: 0, label: null });
      return;
    }
    const heading = row.headingUuid ? places.get(row.headingUuid) : undefined;
    const place = under(heading, entryPosition.get(row.uuid) ?? 0);
    places.set(
      row.uuid,
      row.headingUuid && !heading?.label ? { ...place, label: null } : place,
    );
  });

  return places;
};
