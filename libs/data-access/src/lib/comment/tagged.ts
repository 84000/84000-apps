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

  const rootByComment = new Map(
    rows.map((row) => [row.uuid, rootUuidOf(row.uuid, scopeRows)]),
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
