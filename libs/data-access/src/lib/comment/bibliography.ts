import type { DataClient } from '../types';
import {
  commentAnchorsInHtml,
  type HtmlCommentAnchor,
} from '../html/comment-marks';

/** Rows per request. PostgREST truncates a read at 1000 without an error. */
const PAGE_ROWS = 1000;

/** Where a work's bibliography places its comment threads. */
export interface BibliographyCommentAnchors {
  /** Every row of the work's bibliography, in `sort` order. */
  rows: string[];
  /** Each marked row's anchors, in document order. */
  anchorsByRow: Map<string, HtmlCommentAnchor[]>;
  /** Every thread a mark anywhere in the work's bibliography points at. */
  markedThreads: Set<string>;
}

/** Reads every page of a query built by `page`, or null on the first error. */
const readAll = async <T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  what: string,
): Promise<T[] | null> => {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) {
      console.error(`Error reading ${what}:`, error);
      return null;
    }
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_ROWS) return all;
  }
};

/**
 * The rows of a work's draft bibliography and the comment marks they carry.
 *
 * A bibliography stores its anchors inline in `bibl_html` rather than as
 * annotation rows, so this reads the rows that carry one. Null when the read
 * fails.
 */
export const getBibliographyCommentAnchors = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<BibliographyCommentAnchors | null> => {
  const [rows, marked] = await Promise.all([
    readAll<{ uuid: string }>(
      (from, to) =>
        client
          .from('bibliographies')
          .select('uuid')
          .eq('work_uuid', workUuid)
          .order('sort')
          .order('uuid')
          .range(from, to),
      'bibliography rows',
    ),
    readAll<{ uuid: string; bibl_html: string | null }>(
      (from, to) =>
        client
          .from('bibliographies')
          .select('uuid, bibl_html')
          .eq('work_uuid', workUuid)
          .like('bibl_html', '%type="comment"%')
          .order('uuid')
          .range(from, to),
      'bibliography comment marks',
    ),
  ]);
  if (!rows || !marked) return null;

  const anchorsByRow = new Map<string, HtmlCommentAnchor[]>();
  const markedThreads = new Set<string>();
  for (const row of marked) {
    const anchors = commentAnchorsInHtml(row.bibl_html ?? '');
    if (anchors.length === 0) continue;
    anchorsByRow.set(row.uuid, anchors);
    anchors.forEach(({ comment }) => markedThreads.add(comment));
  }

  return { rows: rows.map(({ uuid }) => uuid), anchorsByRow, markedThreads };
};
