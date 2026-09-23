import {
  commentFromDTO,
  type Comment,
  type CommentDTO,
  type DataClient,
  normalizeCommentTag,
} from '../types';
import { DEFAULT_CONTENT_SOURCE, type ContentSource } from '../content-source';
import { getCommentAnchorPassageUuids } from './anchors';
import { readCommentRows, rootUuidOf } from './rows';

const PAGE_SIZE = 1000;

/** A comment carrying a tag, placed in its work and thread. */
export type TaggedComment = {
  comment: Comment;
  workUuid: string;
  /** The root of the comment's thread. Absent when its parent chain is broken. */
  threadUuid?: string;
  /**
   * Where the thread sits: the passages anchoring it, or the passage it was
   * written on when nothing anchors it.
   */
  passageUuids: string[];
};

type TaggedCommentRow = CommentDTO & { work_uuid: string };

/**
 * Comments carrying `tag`, oldest first, across the library or within one
 * work. Draft-only, like every comment read.
 */
export const getTaggedComments = async ({
  client,
  tag,
  workUuid,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  tag: string;
  workUuid?: string;
  source?: ContentSource;
}): Promise<TaggedComment[]> => {
  const normalized = normalizeCommentTag(tag);
  if (source === 'published' || !normalized) return [];

  const rows: TaggedCommentRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .rpc('get_tagged_comments', {
        p_tag: normalized,
        p_work_uuid: workUuid ?? null,
      })
      .order('created_at', { ascending: true })
      .order('uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error reading tagged comments:', error);
      return [];
    }

    rows.push(...((data ?? []) as TaggedCommentRow[]));
    hasMore = (data?.length ?? 0) === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  if (rows.length === 0) return [];

  const scopes = [...new Set(rows.map((row) => row.entity_uuid))];
  const scopeRows = await readCommentRows(client, 'entity_uuid', scopes);
  if (!scopeRows) return [];

  // One lookup for every walk: rebuilding it per row is quadratic, and a
  // library-wide read reaches thousands of rows.
  const scopeByUuid = new Map(scopeRows.map((row) => [row.uuid, row]));
  const rootByComment = new Map(
    rows.map((row) => [row.uuid, rootUuidOf(row.uuid, scopeByUuid)]),
  );

  const roots = [
    ...new Set(
      [...rootByComment.values()].filter((uuid): uuid is string => !!uuid),
    ),
  ];
  const anchors = await getCommentAnchorPassageUuids({
    client,
    commentUuids: roots,
    source,
  });

  return rows.map(({ work_uuid, ...row }) => {
    const threadUuid = rootByComment.get(row.uuid);
    const anchored = threadUuid ? anchors?.get(threadUuid) : undefined;

    return {
      comment: commentFromDTO(row),
      workUuid: work_uuid,
      threadUuid,
      passageUuids: anchored?.length ? anchored : [row.entity_uuid],
    };
  });
};

/** One work's comments carrying a tag. */
export type TaggedCommentWork = {
  workUuid: string;
  count: number;
  /** When the newest of them was written. */
  latestAt: string;
};

type TaggedCommentWorkRow = {
  uuid: string;
  work_uuid: string;
  created_at: string;
};

/**
 * How many comments carry `tag` in each work, newest activity first.
 *
 * The summary `getTaggedComments` would give, without its cost: it reads three
 * columns and none of the threads, anchors or bodies placing a comment needs.
 */
export const getTaggedCommentWorks = async ({
  client,
  tag,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  tag: string;
  source?: ContentSource;
}): Promise<TaggedCommentWork[]> => {
  const normalized = normalizeCommentTag(tag);
  if (source === 'published' || !normalized) return [];

  const works = new Map<string, TaggedCommentWork>();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .rpc('get_tagged_comments', { p_tag: normalized, p_work_uuid: null })
      .select('uuid, work_uuid, created_at')
      .order('created_at', { ascending: true })
      .order('uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error reading tagged comment works:', error);
      return [];
    }

    const page = (data ?? []) as unknown as TaggedCommentWorkRow[];

    // Oldest first, so each row is the newest yet seen for its work.
    for (const row of page) {
      const work = works.get(row.work_uuid);
      if (work) {
        work.count += 1;
        work.latestAt = row.created_at;
      } else {
        works.set(row.work_uuid, {
          workUuid: row.work_uuid,
          count: 1,
          latestAt: row.created_at,
        });
      }
    }

    hasMore = page.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return [...works.values()].sort(
    (a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt),
  );
};
