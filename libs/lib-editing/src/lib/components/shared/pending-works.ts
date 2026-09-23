import type { TaggedCommentWorkEntry } from '@eightyfourthousand/client-graphql';
import type { Work } from '@eightyfourthousand/data-access';
import { parseToh } from '@eightyfourthousand/lib-utils';

/** One work on the Pending tab. */
export type PendingWorkRow = {
  uuid: string;
  title: string;
  toh: string;
  tohSearch: string;
  /** Pending comments in the work. */
  count: number;
};

/**
 * One row per work with pending comments, in the order given — newest activity
 * first, as the server returns them. A work missing from `works` still gets a
 * row, so nothing tagged goes unlisted.
 */
export const pendingWorkRows = (
  works: Work[],
  tagged: TaggedCommentWorkEntry[],
): PendingWorkRow[] => {
  const byUuid = new Map(works.map((work) => [work.uuid, work]));

  return tagged.map(({ workUuid, count }) => {
    const work = byUuid.get(workUuid);
    return {
      uuid: workUuid,
      title: work?.title ?? workUuid,
      toh: work ? parseToh(work.toh.join(',')) : '',
      tohSearch: work?.toh.join(' ') ?? '',
      count,
    };
  });
};
