import type { TaggedCommentEntry } from '@eightyfourthousand/client-graphql';
import type { Work } from '@eightyfourthousand/data-access';
import { parseToh } from '@eightyfourthousand/lib-utils';
import { commentTextFromHtml } from './comments/comment-html';

/** One work on the Pending tab. */
export type PendingWorkRow = {
  uuid: string;
  title: string;
  toh: string;
  tohSearch: string;
  /** Pending comments in the work. */
  count: number;
  /** The most recent pending comment, as plain text. */
  latest: string;
  latestAt: string;
};

/**
 * Groups tagged comments into one row per work, newest activity first. A work
 * missing from `works` still gets a row, so nothing tagged goes unlisted.
 */
export const pendingWorkRows = (
  works: Work[],
  tagged: TaggedCommentEntry[],
): PendingWorkRow[] => {
  const byUuid = new Map(works.map((work) => [work.uuid, work]));
  const rows = new Map<string, PendingWorkRow>();

  for (const { comment, workUuid } of tagged) {
    const row = rows.get(workUuid);
    if (row) {
      row.count += 1;
      if (Date.parse(comment.createdAt) > Date.parse(row.latestAt)) {
        row.latest = commentTextFromHtml(comment.content);
        row.latestAt = comment.createdAt;
      }
      continue;
    }

    const work = byUuid.get(workUuid);
    rows.set(workUuid, {
      uuid: workUuid,
      title: work?.title ?? workUuid,
      toh: work ? parseToh(work.toh.join(',')) : '',
      tohSearch: work?.toh.join(' ') ?? '',
      count: 1,
      latest: commentTextFromHtml(comment.content),
      latestAt: comment.createdAt,
    });
  }

  return [...rows.values()].sort(
    (a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt),
  );
};
