import type { GraphQLClient } from 'graphql-request';
import {
  getBibliographyRows,
  outlineBibliography,
  saveBibliographyRows,
  storedBibliographyHtml,
  type BibliographyRow,
  type DataClient,
} from '@eightyfourthousand/data-access';
import {
  rowKindOf,
  type SpineSeed,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import {
  bibliographyContentToHTML,
  bibliographyRowSource,
} from './bibliography-codec';
import { buildBibliographySchemaExtensions } from './bibliography-extensions';
import {
  BIBLIOGRAPHY_LABEL_PREFIX,
  outlineBibliographyRows,
} from './bibliography-outline';
import { createStackWork } from './stack-work';

/**
 * Rows in the order the readers show them: the top-level entries by `sort`,
 * then each heading by `sort`, followed by the entries under it by `sort`. An
 * entry whose heading is not among the rows keeps its own place.
 */
export const bibliographyReadingOrder = (
  rows: readonly BibliographyRow[],
): BibliographyRow[] => {
  const sorted = [...rows].sort((a, b) => a.sort - b.sort);
  const headings = new Set(
    sorted.filter((row) => row.isHeading).map((row) => row.uuid),
  );
  const entriesUnder = new Map<string, BibliographyRow[]>();
  sorted.forEach((row) => {
    if (row.isHeading || !row.headingUuid || !headings.has(row.headingUuid)) {
      return;
    }
    entriesUnder.set(row.headingUuid, [
      ...(entriesUnder.get(row.headingUuid) ?? []),
      row,
    ]);
  });
  const isTopLevelEntry = (row: BibliographyRow) =>
    !row.isHeading && !row.headingUuid;
  return [
    ...sorted.filter(isTopLevelEntry),
    ...sorted.flatMap((row) => {
      if (row.isHeading) return [row, ...(entriesUnder.get(row.uuid) ?? [])];
      if (isTopLevelEntry(row)) return [];
      return row.headingUuid && headings.has(row.headingUuid) ? [] : [row];
    }),
  ];
};

/** The spine seeds of a work's bibliography rows, in reading order. */
export const bibliographySeeds = (
  rows: readonly BibliographyRow[],
): SpineSeed[] => {
  const places = outlineBibliography(rows);
  return bibliographyReadingOrder(rows).map((row): SpineSeed => {
    const place = places.get(row.uuid);
    return {
      uuid: row.uuid,
      label: place?.label ? `${BIBLIOGRAPHY_LABEL_PREFIX}${place.label}` : '',
      type: row.isHeading ? 'bibliographyHeader' : 'bibliography',
      sort: row.sort,
      ...(row.headingUuid ? { parent: row.headingUuid } : {}),
      ...(place?.depth ? { depth: place.depth } : {}),
    };
  });
};

/** A work's bibliography as a stack work, and the rows it was read from. */
export type BibliographyWork = {
  work: WorkDocument;
  /** The stored rows by uuid, kept current by each save. */
  rows: Map<string, BibliographyRow>;
};

/**
 * Read a work's bibliography into its own stack work, seeded in full.
 *
 * Null when the rows cannot be read, so a failure is not drawn as an empty
 * bibliography, and never throws: the passages load alongside it.
 */
export const loadBibliographyWork = async ({
  workUuid,
  client,
  graphql,
}: {
  workUuid: string;
  client: DataClient;
  graphql: GraphQLClient;
}): Promise<BibliographyWork | null> => {
  const read = await getBibliographyRows({ client, workUuid }).catch(
    (error: unknown) => {
      console.error('Failed to read bibliography:', error);
      return null;
    },
  );
  if (!read) return null;
  const rows = new Map(read.map((row) => [row.uuid, row]));
  const work = createStackWork({
    workUuid,
    client: graphql,
    source: bibliographyRowSource({
      workUuid,
      read: async (uuids) =>
        uuids.flatMap((uuid) => {
          const row = rows.get(uuid);
          return row ? [row] : [];
        }),
    }),
    extensions: buildBibliographySchemaExtensions(),
    outline: outlineBibliographyRows,
  });
  work.seedSpine(bibliographySeeds(read));
  return { work, rows };
};

/** A row to place: its run, its stored sort, and whether it is written anyway. */
type Placing = { under?: string; sort?: number; changed?: boolean };

/**
 * The positions of the rows to keep their stored sorts: each leaves room for
 * the rows between it and the one before, and the first for those before it
 * after `floor`. Rows written anyway count for less, so that as few rows as
 * possible are written for their sorts alone.
 */
const keepable = (rows: Placing[], floor: number) => {
  // Room between two rows is their sorts' gap less their positions' gap,
  // so the kept rows are a heaviest non-decreasing run of `sort - position`.
  const key = (i: number) => (rows[i].sort as number) - i;
  const candidates = rows.flatMap((row, i) =>
    row.sort !== undefined && key(i) > floor ? [i] : [],
  );
  const heavy = candidates.length + 1;
  const keys = [...new Set(candidates.map(key))].sort((a, b) => a - b);
  const rank = new Map(keys.map((value, at) => [value, at + 1]));

  // A Fenwick tree of the heaviest run ending at each key or below, as
  // [weight, last position].
  type Run = [number, number];
  const tree: Run[] = keys.map((): Run => [0, -1]).concat([[0, -1]]);
  const heaviest = (at: number) => {
    let best: Run = [0, -1];
    for (; at > 0; at -= at & -at) if (tree[at][0] > best[0]) best = tree[at];
    return best;
  };
  const raise = (at: number, run: Run) => {
    for (; at < tree.length; at += at & -at) {
      if (run[0] > tree[at][0]) tree[at] = run;
    }
  };

  const before = new Map<number, number>();
  let top: Run = [0, -1];
  candidates.forEach((i) => {
    const at = rank.get(key(i)) as number;
    const [weight, last] = heaviest(at);
    before.set(i, last);
    const run: Run = [weight + (rows[i].changed ? 1 : heavy), i];
    raise(at, run);
    if (run[0] > top[0]) top = run;
  });
  const kept = new Set<number>();
  for (let i = top[1]; i >= 0; i = before.get(i) ?? -1) kept.add(i);
  return kept;
};

/**
 * Sorts for a run of rows. The rows `keepable` picks keep their stored
 * sorts; the rest take the next sort after the row before.
 */
const placeRun = (rows: Placing[]): number[] => {
  const defined = rows.flatMap((row) => row.sort ?? []);
  const floor = Math.min(0, ...defined.map((sort) => sort - 1));
  const kept = keepable(rows, floor);
  let previous = floor;
  return rows.map((row, i) => {
    previous = kept.has(i) ? (row.sort as number) : previous + 1;
    return previous;
  });
};

/**
 * Sorts for rows in reading order, given those they have stored. The headings
 * and the top-level entries share one run, so the top-level entries, read
 * first, sort before every heading; each heading's entries are a run of their
 * own. Each run keeps as many stored sorts as it can.
 */
export const placeBibliographyRows = (rows: Placing[]): number[] => {
  const runs = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = row.under ?? '';
    runs.set(key, [...(runs.get(key) ?? []), i]);
  });
  const sorts = rows.map(() => 0);
  runs.forEach((run) =>
    placeRun(run.map((i) => rows[i])).forEach((sort, at) => {
      sorts[run[at]] = sort;
    }),
  );
  return sorts;
};

/** What a bibliography save writes, deletes and settles. */
export type BibliographySavePlan = {
  /** New rows and rows whose content or placement changed, as stored. */
  rows: BibliographyRow[];
  /** Stored rows that left the work. */
  deleteUuids: string[];
  /** Edited documents, at the version the plan read. */
  settled: { uuid: string; version: number }[];
  /**
   * Changed rows this save cannot write yet: emptied, or under a new heading
   * it does not write.
   */
  held: string[];
};

const sameRow = (a: BibliographyRow, b: BibliographyRow) =>
  a.html === b.html &&
  a.sort === b.sort &&
  a.isHeading === b.isHeading &&
  a.headingUuid === b.headingUuid;

/**
 * Plan a bibliography save: every row placed in reading order under the
 * heading the outline gives it. A row with no text is not written, nor,
 * while it is new, the rows under it.
 */
export const planBibliographySave = ({
  work,
  rows,
}: BibliographyWork): BibliographySavePlan => {
  const entries = work.spine.entries();
  const drafts = entries.map((entry) => {
    const stored = rows.get(entry.uuid);
    const doc = work.store.peek(entry.uuid);
    const kind = rowKindOf(entry.type);
    const edited = !!doc && (doc.isDirty || !stored);
    const row: BibliographyRow = {
      uuid: entry.uuid,
      workUuid: work.workUuid,
      html: edited
        ? bibliographyContentToHTML(doc.toNode().content, kind)
        : (stored?.html ?? ''),
      sort: stored?.sort ?? 0,
      isHeading: kind === 'heading',
      headingUuid: entry.parent ?? null,
    };
    return { entry, stored, doc, row, html: storedBibliographyHtml(row) };
  });
  // New rows with no text are not written, nor while they are new the rows
  // under them, so they take no place among the sorts.
  const unwritten = new Set<string>();
  const held = new Set<string>();
  const placed = drafts.filter(({ entry, stored, row, html }) => {
    const parent = row.headingUuid;
    if (html !== null && !(parent && unwritten.has(parent))) return true;
    // A new row with nothing in it is a draft, not an unsaved change.
    if (stored || html !== null) held.add(entry.uuid);
    if (stored) return true;
    unwritten.add(entry.uuid);
    return false;
  });
  const sorts = placeBibliographyRows(
    placed.map(({ row, stored, html }) => ({
      under: row.isHeading ? undefined : (row.headingUuid ?? undefined),
      sort: stored?.sort,
      changed: !stored || html === null || !sameRow(stored, { ...row, html }),
    })),
  );

  const plan: BibliographySavePlan = {
    rows: [],
    // Every stored row is in the spine, so one that is not has left the work.
    deleteUuids: [...rows.keys()].filter((uuid) => !work.spine.meta(uuid)),
    settled: [],
    held: drafts.flatMap(({ entry }) =>
      held.has(entry.uuid) ? [entry.uuid] : [],
    ),
  };
  placed.forEach(({ entry, stored, doc, html, ...draft }, i) => {
    const row = { ...draft.row, sort: sorts[i] };
    const same = !!stored && html !== null && sameRow(stored, { ...row, html });
    if (!same && held.has(entry.uuid)) return;
    if (doc?.isDirty) {
      plan.settled.push({ uuid: entry.uuid, version: doc.version });
    }
    if (!same) plan.rows.push(row);
  });
  return plan;
};

/** How many bibliography rows hold changes the last save did not write. */
export const unsavedBibliographyChanges = (bibliography: BibliographyWork) => {
  const plan = planBibliographySave(bibliography);
  return plan.rows.length + plan.deleteUuids.length + plan.held.length;
};

/** Whether a bibliography holds changes the last save did not write. */
export const hasUnsavedBibliographyChanges = (bibliography: BibliographyWork) =>
  unsavedBibliographyChanges(bibliography) > 0;

/**
 * Read the stored rows back, after a save whose outcome is unknown, so the
 * next one plans from what the server holds.
 */
const refreshRows = async (
  { work, rows }: BibliographyWork,
  client: DataClient,
) => {
  const read = await getBibliographyRows({
    client,
    workUuid: work.workUuid,
  }).catch(() => null);
  if (!read) return;
  // Only the rows this editor knows: one it has never seen is not its to
  // delete.
  const known = read.filter(
    (row) => rows.has(row.uuid) || work.spine.meta(row.uuid),
  );
  rows.clear();
  known.forEach((row) => rows.set(row.uuid, row));
  work.spine.adoptSorts(new Map(known.map((row) => [row.uuid, row.sort])));
};

/**
 * Write a bibliography's new, edited and moved rows and delete the ones it
 * removed, and settle them once the server agrees. False when the save
 * failed or left rows it could not write.
 */
export const saveBibliographyWork = async (
  bibliography: BibliographyWork,
  client: DataClient,
): Promise<boolean> => {
  const { work, rows } = bibliography;
  const plan = planBibliographySave(bibliography);
  const settle = () =>
    plan.settled.forEach(({ uuid, version }) =>
      work.store.peek(uuid)?.markSynced(version),
    );
  const complete = () => {
    if (!plan.held.length) return true;
    console.error(
      'Bibliography rows left unsaved, empty or under an empty heading:',
      plan.held,
    );
    return false;
  };
  if (!plan.rows.length && !plan.deleteUuids.length) {
    settle();
    return complete();
  }

  const result = await saveBibliographyRows({
    client,
    workUuid: work.workUuid,
    rows: plan.rows,
    deleteUuids: plan.deleteUuids,
  });
  if (!result.success) {
    console.error('Failed to save bibliography:', result.error);
    if (result.outcomeUnknown) await refreshRows(bibliography, client);
    return false;
  }

  const created = plan.rows
    .filter((row) => !rows.has(row.uuid))
    .map((row) => row.uuid);
  result.rows.forEach((row) => rows.set(row.uuid, row));
  plan.deleteUuids.forEach((uuid) => rows.delete(uuid));
  // Only after the server has them: a document marked synced on a failed
  // write would drop the edit from the next save.
  settle();
  work.spine.settleSave({ deleted: plan.deleteUuids, created });
  work.spine.adoptSorts(
    new Map(result.rows.map((row) => [row.uuid, row.sort])),
  );
  return complete();
};
