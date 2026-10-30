import {
  bibliographyRowFromDTO,
  type BibliographyRow,
  type BibliographyRowDTO,
  type DataClient,
} from '../types';
import { BIBLIOGRAPHY_ALLOWLIST, htmlHasText, sanitizeHtml } from '../html';
import { rolledBack } from '../passage/save/commit';

/** Rows per request when reading a work's bibliography. */
const PAGE_ROWS = 1000;

const ROW_COLUMNS =
  'uuid, work_uuid, bibl_html, sort, is_heading, heading_uuid';

/**
 * Every bibliography row of one work, headings and entries alike, in `sort`
 * order. Reads the draft table: this is the editor's read, and the published
 * snapshot is not editable. `null` when the read fails, so a caller never
 * mistakes a failure for an empty bibliography.
 */
export const getBibliographyRows = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<BibliographyRow[] | null> => {
  const rows: BibliographyRow[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await client
      .from('bibliographies')
      .select(ROW_COLUMNS)
      .eq('work_uuid', workUuid)
      .order('sort')
      .order('uuid')
      .range(from, from + PAGE_ROWS - 1);
    if (error) {
      console.error(
        `Error reading bibliography rows for work ${workUuid}:`,
        error,
      );
      return null;
    }
    const page = (data ?? []) as BibliographyRowDTO[];
    rows.push(...page.map(bibliographyRowFromDTO));
    if (page.length < PAGE_ROWS) return rows;
  }
};

export type BibliographySaveResult =
  | {
      success: true;
      /** The rows as stored, after sanitizing. */
      rows: BibliographyRow[];
      deleted: number;
    }
  | {
      success: false;
      error: string;
      /** The save may have been applied: its response was lost. */
      outcomeUnknown: boolean;
    };

const failure = (
  error: string,
  outcomeUnknown = false,
): BibliographySaveResult => ({ success: false, error, outcomeUnknown });

/**
 * A row's `html` as it is stored. An entry keeps the markup the bibliography
 * allows and its whitespace. A heading is plain text, rendered as text, so it
 * is stored as given: parsing it as HTML would change it on every save.
 * `null` when nothing is left.
 */
export const storedBibliographyHtml = (row: BibliographyRow): string | null => {
  if (row.isHeading) return row.html.trim() ? row.html : null;
  const html = sanitizeHtml({
    html: row.html,
    allowlist: BIBLIOGRAPHY_ALLOWLIST,
    trim: false,
  });
  return htmlHasText(html) ? html : null;
};

/**
 * Writes one save of a work's bibliography in a single transaction: `rows`
 * are upserted whole, then `deleteUuids` are deleted. The database refuses a
 * save that would nest a row under anything but a heading of the same work,
 * nest a heading inside itself, or delete a heading that still has rows;
 * nothing is written then. An entry with no heading sits at the top level.
 *
 * Placement is the caller's: `sort` and `headingUuid` are written as given.
 */
export const saveBibliographyRows = async ({
  client,
  workUuid,
  rows,
  deleteUuids = [],
}: {
  client: DataClient;
  workUuid: string;
  rows: readonly BibliographyRow[];
  deleteUuids?: readonly string[];
}): Promise<BibliographySaveResult> => {
  if (rows.length === 0 && deleteUuids.length === 0) {
    return { success: true, rows: [], deleted: 0 };
  }

  const seen = new Set<string>();
  const stored: BibliographyRow[] = [];
  for (const row of rows) {
    if (row.workUuid !== workUuid) {
      return failure(`Row ${row.uuid} belongs to another work`);
    }
    if (seen.has(row.uuid)) {
      return failure(`Row ${row.uuid} is saved twice`);
    }
    seen.add(row.uuid);
    const html = storedBibliographyHtml(row);
    if (html === null) {
      return failure(`Row ${row.uuid} is empty`);
    }
    stored.push({ ...row, html });
  }
  const deleting = deleteUuids.find((uuid) => seen.has(uuid));
  if (deleting) {
    return failure(`Row ${deleting} is both saved and deleted`);
  }

  const { data, error } = await client.rpc('apply_bibliography_save', {
    p_work_uuid: workUuid,
    p_rows: stored.map((row) => ({
      uuid: row.uuid,
      bibl_html: row.html,
      sort: row.sort,
      is_heading: row.isHeading,
      heading_uuid: row.headingUuid,
    })),
    p_delete: deleteUuids,
  });

  if (error) {
    console.error('Error saving bibliography:', error);
    const unknown = !rolledBack(error.code);
    return failure(
      `${unknown ? 'The save may have been applied' : 'Nothing was saved'}: ${error.message}`,
      unknown,
    );
  }

  // The database checks these itself and refuses a short write, so a
  // mismatch here means its answer is not the one this code expects.
  const counts = data as { rows?: number; deleted?: number } | null;
  if (
    counts?.rows !== stored.length ||
    counts?.deleted !== deleteUuids.length
  ) {
    console.error('Unexpected bibliography save counts:', counts);
    return failure(
      'The save was applied, but reported unexpected counts',
      true,
    );
  }

  return { success: true, rows: stored, deleted: counts.deleted };
};
