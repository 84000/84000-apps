import type { GraphQLClient } from 'graphql-request';
import {
  getBibliographyRows,
  outlineBibliography,
  saveBibliographyRows,
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
import { createStackWork } from './stack-work';

/** The prefix the readers give a bibliography row's label. */
const LABEL_PREFIX = 'b.';

/**
 * Rows in the order the readers show them: each heading by `sort`, followed by
 * the entries under it by `sort`. An entry with no heading row to sit under
 * keeps its own place.
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
  return sorted.flatMap((row) => {
    if (row.isHeading) return [row, ...(entriesUnder.get(row.uuid) ?? [])];
    return row.headingUuid && headings.has(row.headingUuid) ? [] : [row];
  });
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
      label: place?.label ? `${LABEL_PREFIX}${place.label}` : '',
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
 * bibliography.
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
  const read = await getBibliographyRows({ client, workUuid });
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
  });
  work.spine.seed(bibliographySeeds(read));
  return { work, rows };
};

/** Whether a bibliography save has anything to write. */
export const hasUnsavedBibliographyChanges = ({ work }: BibliographyWork) =>
  work.store.dirty().some((uuid) => work.spine.meta(uuid));

/**
 * Write a bibliography's edited rows, and mark them synced once the server
 * agrees. Placement is written as read: rows are edited, not moved.
 */
export const saveBibliographyWork = async (
  bibliography: BibliographyWork,
  client: DataClient,
): Promise<boolean> => {
  const { work, rows } = bibliography;
  const edited = work.store.dirty().flatMap((uuid) => {
    const meta = work.spine.meta(uuid);
    const doc = work.store.peek(uuid);
    const row = rows.get(uuid);
    if (!meta || !doc || !row) return [];
    return [
      {
        row: {
          ...row,
          html: bibliographyContentToHTML(
            doc.toNode().content,
            rowKindOf(meta.type),
          ),
        },
        // Read with the payload: an edit made while the request is in
        // flight is not in it, and must leave its row dirty.
        version: doc.version,
      },
    ];
  });
  if (!edited.length) return true;

  const result = await saveBibliographyRows({
    client,
    workUuid: work.workUuid,
    rows: edited.map(({ row }) => row),
  });
  if (!result.success) {
    console.error('Failed to save bibliography:', result.error);
    return false;
  }

  result.rows.forEach((row) => rows.set(row.uuid, row));
  edited.forEach(({ row, version }) =>
    work.store.peek(row.uuid)?.markSynced(version),
  );
  return true;
};
