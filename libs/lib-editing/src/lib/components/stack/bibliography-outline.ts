import {
  rowKindOf,
  type RowOutline,
  type RowPlace,
  type SpineEntry,
} from '@eightyfourthousand/lib-doc-model';

/** The prefix the readers give a bibliography row's label. */
export const BIBLIOGRAPHY_LABEL_PREFIX = 'b.';

const isHeading = (entry: SpineEntry) => rowKindOf(entry.type) === 'heading';

type Place = { label: string | null; depth: number };

/**
 * Labels and nesting for a bibliography's rows, from their order: what
 * `outlineBibliography` gives once a save has placed the rows in that order.
 *
 * - A heading nests under its own parent and is numbered among the headings
 *   under the same one.
 * - An entry nests under the heading before it and is numbered among the
 *   entries under that heading. Entries before the first heading sit at the
 *   top level, and top-level headings are numbered after them.
 *
 * A heading the top level cannot reach, and the entries under it, get no
 * label, as no reader shows them.
 */
export const outlineBibliographyRows: RowOutline = (entries) => {
  const headings = new Map(
    entries.filter(isHeading).map((entry) => [entry.uuid, entry]),
  );

  const firstHeading = entries.findIndex(isHeading);
  const topLevelEntries = firstHeading < 0 ? entries.length : firstHeading;

  const position = new Map<string, number>();
  const counts = new Map<string, number>([['under:', topLevelEntries]]);
  const count = (key: string) => {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  };
  entries
    .filter(isHeading)
    .forEach((heading) =>
      position.set(heading.uuid, count(`under:${heading.parent ?? ''}`)),
    );

  const headingPlaces = new Map<string, Place>();
  const placeHeading = (uuid: string, seen = new Set<string>()): Place => {
    const known = headingPlaces.get(uuid);
    if (known) return known;
    const heading = headings.get(uuid);
    const at = position.get(uuid) ?? 0;
    let place: Place;
    if (!heading || seen.has(uuid)) {
      place = { label: null, depth: 0 };
    } else if (!heading.parent) {
      place = { label: String(at), depth: 0 };
    } else if (!headings.has(heading.parent)) {
      place = { label: null, depth: 0 };
    } else {
      const parent = placeHeading(heading.parent, new Set([...seen, uuid]));
      place =
        parent.label === null
          ? { label: null, depth: 0 }
          : { label: `${parent.label}.${at}`, depth: parent.depth + 1 };
    }
    headingPlaces.set(uuid, place);
    return place;
  };

  const prefixed = (label: string | null) =>
    label === null ? '' : `${BIBLIOGRAPHY_LABEL_PREFIX}${label}`;

  const places = new Map<string, RowPlace>();
  let current: string | undefined;
  entries.forEach((entry) => {
    if (isHeading(entry)) {
      current = entry.uuid;
      const { label, depth } = placeHeading(entry.uuid);
      places.set(entry.uuid, {
        label: prefixed(label),
        ...(entry.parent ? { parent: entry.parent } : {}),
        ...(depth ? { depth } : {}),
      });
      return;
    }
    const at = count(`entries:${current ?? ''}`);
    if (current === undefined) {
      places.set(entry.uuid, { label: prefixed(String(at)) });
      return;
    }
    const heading = placeHeading(current);
    places.set(entry.uuid, {
      label: prefixed(heading.label === null ? null : `${heading.label}.${at}`),
      parent: current,
      depth: heading.depth + 1,
    });
  });
  return places;
};
