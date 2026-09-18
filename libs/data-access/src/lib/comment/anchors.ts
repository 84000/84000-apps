import type { DataClient } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  rpcFor,
  type ContentSource,
} from '../content-source';

/** The annotation type whose content names a comment thread. */
const COMMENT_ANNOTATION_TYPE = 'comment';

/**
 * Batched because PostgREST rejects a URL over ~16KB, and an RPC argument list
 * counts toward it (`postgrest-silent-limits`). Matches the uuid batch size the
 * comment reads use.
 */
const UUID_BATCH_SIZE = 200;

/**
 * Which of `commentUuids` still have a `comment` annotation pointing at them.
 *
 * The complement is what makes a thread unanchored: a thread nothing points at
 * has no position, and so cannot be found by the reads that resolve position.
 * Deliberately not scoped to a work — a thread uuid is unique, and an anchor
 * may sit on a passage the caller did not ask about, which is exactly the case
 * that must not be mistaken for no anchor at all.
 *
 * Empty for a `published` content source: comment annotations are excluded from
 * published data, so every thread would look unanchored there.
 */
export const getAnchoredCommentUuids = async ({
  client,
  commentUuids,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  commentUuids: readonly string[];
  source?: ContentSource;
}): Promise<Set<string>> => {
  const anchored = new Set<string>();

  if (source === 'published' || commentUuids.length === 0) {
    return anchored;
  }

  for (let i = 0; i < commentUuids.length; i += UUID_BATCH_SIZE) {
    const batch = commentUuids.slice(i, i + UUID_BATCH_SIZE) as string[];

    const { data, error } = await client.rpc(
      rpcFor('passageReferences', source),
      {
        annotation_type: COMMENT_ANNOTATION_TYPE,
        target_uuids: batch,
      },
    );

    if (error) {
      console.error('Error reading comment anchors:', error);
      // An empty set would report every thread as unanchored, which reads as
      // the anchors having been deleted. Failing closed keeps a read error from
      // looking like data loss.
      return new Set(commentUuids);
    }

    for (const row of (data ?? []) as { target_uuid: string | null }[]) {
      if (row.target_uuid) anchored.add(row.target_uuid);
    }
  }

  return anchored;
};
