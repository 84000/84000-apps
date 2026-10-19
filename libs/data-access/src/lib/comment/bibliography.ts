import type { DataClient } from '../types';
import {
  commentAnchorsInHtml,
  type HtmlCommentAnchor,
} from '../html/comment-marks';

/** Rows per request. PostgREST truncates a read at 1000 without an error. */
const PAGE_ROWS = 1000;

/** Uuids per `in` filter, inside PostgREST's URL limit. */
const UUID_BATCH_SIZE = 200;

/** Where a work's bibliography places its comment threads. */
export interface BibliographyCommentAnchors {
  /** The requested rows that belong to the work, in request order. */
  rows: string[];
  /** Each marked row's anchors, in document order. */
  anchorsByRow: Map<string, HtmlCommentAnchor[]>;
  /** Every thread a mark anywhere in the work's bibliography points at. */
  markedThreads: Set<string>;
}

/**
 * The comment marks in a work's draft bibliography, and which of `rowUuids`
 * are its rows.
 *
 * A bibliography stores its anchors inline in `bibl_html` rather than as
 * annotation rows, so this reads the rows that carry one. Work-wide, so a
 * thread whose mark moved to another row is still anchored. Null when the read
 * fails.
 */
export const getBibliographyCommentAnchors = async ({
  client,
  workUuid,
  rowUuids,
}: {
  client: DataClient;
  workUuid: string;
  rowUuids: readonly string[];
}): Promise<BibliographyCommentAnchors | null> => {
  const anchorsByRow = new Map<string, HtmlCommentAnchor[]>();
  const markedThreads = new Set<string>();
  const inWork = new Set<string>();

  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await client
      .from('bibliographies')
      .select('uuid, bibl_html')
      .eq('work_uuid', workUuid)
      .like('bibl_html', '%type="comment"%')
      .order('uuid')
      .range(from, from + PAGE_ROWS - 1);
    if (error) {
      console.error('Error reading bibliography comment marks:', error);
      return null;
    }

    const page = (data ?? []) as { uuid: string; bibl_html: string | null }[];
    for (const row of page) {
      const anchors = commentAnchorsInHtml(row.bibl_html ?? '');
      if (anchors.length === 0) continue;
      anchorsByRow.set(row.uuid, anchors);
      anchors.forEach(({ comment }) => markedThreads.add(comment));
    }
    if (page.length < PAGE_ROWS) break;
  }

  for (let i = 0; i < rowUuids.length; i += UUID_BATCH_SIZE) {
    const { data, error } = await client
      .from('bibliographies')
      .select('uuid')
      .eq('work_uuid', workUuid)
      .in('uuid', rowUuids.slice(i, i + UUID_BATCH_SIZE) as string[]);
    if (error) {
      console.error('Error reading bibliography rows:', error);
      return null;
    }
    (data ?? []).forEach(({ uuid }: { uuid: string }) => inWork.add(uuid));
  }

  return {
    rows: [...new Set(rowUuids)].filter((uuid) => inWork.has(uuid)),
    anchorsByRow,
    markedThreads,
  };
};
