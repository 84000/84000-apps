import {
  COMMENT_COLUMNS,
  isCommentEntityType,
  commentFromDTO,
  type Comment,
  type CommentDTO,
  type CommentEntityType,
  type DataClient,
} from '../types';
import { COMMENT_ALLOWLIST, htmlHasText, sanitizeHtml } from '../html';
import { readCommentRows } from './rows';
import { getCommentThreadByUuid } from './threads';

/** The outcome of a comment write. `comment` carries the saved row on success. */
export type CommentWriteResult = {
  success: boolean;
  comment?: Comment;
  error?: string;
};

/**
 * The outcome of a comment delete. `deletedUuids` names the target and every
 * reply that cascaded with it, so a client can drop them all without refetching.
 */
export type CommentDeleteResult = {
  success: boolean;
  deletedUuids: string[];
  error?: string;
};

/**
 * The table holding each commentable entity. `comments.entity_uuid` is
 * deliberately not a foreign key, so this is the only thing checking that a
 * thread hangs off something that exists.
 */
const ENTITY_TABLES: Record<CommentEntityType, string> = {
  passage: 'passages',
};

/**
 * An RLS-blocked UPDATE or DELETE succeeds with zero rows and no error, so a
 * write that only checks `error` reports a refusal as a save. Every write here
 * asks for its rows back and treats an empty result as a refusal.
 */
const REFUSED =
  'Write was refused. You may not have permission to change this comment.';

const EMPTY = 'Comment cannot be empty';

/**
 * A comment body as it is stored: an HTML fragment, reduced to what a comment
 * may hold.
 *
 * Applied here rather than in a resolver because this is the narrowest point
 * every writer passes through — the GraphQL mutations and the MCP server,
 * which does not go through GraphQL at all. A body that is nothing but markup
 * we refuse sanitizes to nothing, which is empty, which is refused.
 */
const commentBody = (content: string): string | null => {
  const html = sanitizeHtml({ html: content, allowlist: COMMENT_ALLOWLIST });
  return htmlHasText(html) ? html : null;
};

const failure = (error: string): CommentWriteResult => ({
  success: false,
  error,
});

/** Reads one comment row. Distinguishes a read failure from a missing row. */
const readComment = async (
  client: DataClient,
  uuid: string,
): Promise<{ row?: CommentDTO; error?: string }> => {
  const rows = await readCommentRows(client, 'uuid', [uuid]);
  if (!rows) return { error: 'Failed to read comment' };

  const [row] = rows;
  return row ? { row } : {};
};

/**
 * Walks from `uuid` to its thread root within `rows`.
 *
 * Returns undefined where the chain cycles or leaves the set. `parent_uuid` is
 * a plain self-reference with no cycle constraint, and a cycle stores through
 * ordinary statements; the readers survive one but yield no thread, because no
 * comment in a cycle is a root.
 */
const rootUuidOf = (uuid: string, rows: CommentDTO[]): string | undefined => {
  const byUuid = new Map(rows.map((row) => [row.uuid, row]));
  const seen = new Set<string>([uuid]);
  let row = byUuid.get(uuid);

  while (row?.parent_uuid) {
    if (seen.has(row.parent_uuid)) return undefined;
    seen.add(row.parent_uuid);
    row = byUuid.get(row.parent_uuid);
  }

  return row?.uuid;
};

/**
 * The written comment in the shape a thread read produces, so a client can drop
 * it straight into a panel. Only writes that can touch a comment with replies
 * need it — an insert returns a comment that has none by definition.
 *
 * The write has already landed by this point, so a failed read back is still a
 * success; the caller refetches to see it.
 */
const readWritten = async (
  client: DataClient,
  uuid: string,
): Promise<CommentWriteResult> => {
  const comment = await getCommentThreadByUuid({
    client,
    uuid,
    // Comments are draft-only, and the read defaults to the published snapshot.
    source: 'draft',
  });

  if (!comment) {
    console.error(`Saved comment ${uuid} could not be read back`);
  }

  return comment ? { success: true, comment } : { success: true };
};

/**
 * Starts a thread on an entity.
 *
 * `userUuid` is the session's user, never an input: the insert policy binds
 * `user_uuid` to `auth.uid()`, so nobody writes under another name.
 */
export const createComment = async ({
  client,
  entityUuid,
  entityType,
  content,
  userUuid,
}: {
  client: DataClient;
  entityUuid: string;
  entityType: string;
  content: string;
  userUuid: string;
}): Promise<CommentWriteResult> => {
  if (!isCommentEntityType(entityType)) {
    return failure(`Unknown comment entity type: ${entityType}`);
  }

  const body = commentBody(content);
  if (!body) return failure(EMPTY);

  const { data: entity, error: entityError } = await client
    .from(ENTITY_TABLES[entityType])
    .select('uuid')
    .eq('uuid', entityUuid)
    .maybeSingle();

  if (entityError) {
    console.error('Error validating comment entity:', entityError);
    return failure(entityError.message);
  }
  if (!entity) {
    return failure(`No ${entityType} found for ${entityUuid}`);
  }

  const { data, error } = await client
    .from('comments')
    .insert({
      entity_uuid: entityUuid,
      entity_type: entityType,
      content: body,
      user_uuid: userUuid,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error || !data) {
    console.error('Error creating comment:', error);
    return failure(error?.message ?? 'Failed to create comment');
  }

  return {
    success: true,
    comment: {
      ...commentFromDTO(data as unknown as CommentDTO),
      replyCount: 0,
    },
  };
};

/**
 * Adds a reply to an existing comment.
 *
 * Scope is inherited from the parent rather than taken from the caller: a reply
 * filed under a different `entity_uuid` than its thread is absent from the set
 * a reader fetches, so it never appears and nothing logs.
 */
export const replyToComment = async ({
  client,
  parentUuid,
  content,
  userUuid,
}: {
  client: DataClient;
  parentUuid: string;
  content: string;
  userUuid: string;
}): Promise<CommentWriteResult> => {
  const body = commentBody(content);
  if (!body) return failure(EMPTY);

  const parent = await readComment(client, parentUuid);
  if (parent.error) return failure(parent.error);
  if (!parent.row) return failure(`No comment found for ${parentUuid}`);

  const scopeRows = await readCommentRows(client, 'entity_uuid', [
    parent.row.entity_uuid,
  ]);
  if (!scopeRows) return failure('Failed to read comment thread');

  if (!rootUuidOf(parentUuid, scopeRows)) {
    return failure(
      `Comment ${parentUuid} has no thread root; its parent chain is broken or cyclic`,
    );
  }

  const { data, error } = await client
    .from('comments')
    .insert({
      parent_uuid: parentUuid,
      entity_uuid: parent.row.entity_uuid,
      entity_type: parent.row.entity_type,
      content: body,
      user_uuid: userUuid,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error || !data) {
    console.error('Error replying to comment:', error);
    return failure(error?.message ?? 'Failed to reply to comment');
  }

  return {
    success: true,
    comment: {
      ...commentFromDTO(data as unknown as CommentDTO),
      replyCount: 0,
    },
  };
};

/**
 * Edits a comment's body. Author-only, which RLS cannot express — the same
 * UPDATE policy has to admit any editor so that anyone can resolve a thread.
 */
export const updateComment = async ({
  client,
  uuid,
  content,
  userUuid,
}: {
  client: DataClient;
  uuid: string;
  content: string;
  userUuid: string;
}): Promise<CommentWriteResult> => {
  const body = commentBody(content);
  if (!body) return failure(EMPTY);

  const existing = await readComment(client, uuid);
  if (existing.error) return failure(existing.error);
  if (!existing.row) return failure(`No comment found for ${uuid}`);

  if (existing.row.user_uuid !== userUuid) {
    return failure('Permission denied: only the author can edit a comment');
  }

  const { data, error } = await client
    .from('comments')
    .update({ content: body })
    .eq('uuid', uuid)
    .select('uuid');

  if (error) {
    console.error('Error updating comment:', error);
    return failure(error.message);
  }
  if (!data?.length) return failure(REFUSED);

  return readWritten(client, uuid);
};

/**
 * Resolves or un-resolves a thread.
 *
 * Root-only: resolution is a property of the thread and replies inherit it.
 * Any editor may resolve, not only the author — an editorial thread is closed
 * by whoever acts on it.
 */
export const resolveComment = async ({
  client,
  uuid,
  resolved,
  userUuid,
}: {
  client: DataClient;
  uuid: string;
  resolved: boolean;
  userUuid: string;
}): Promise<CommentWriteResult> => {
  const existing = await readComment(client, uuid);
  if (existing.error) return failure(existing.error);
  if (!existing.row) return failure(`No comment found for ${uuid}`);

  if (existing.row.parent_uuid) {
    return failure(
      `Comment ${uuid} is a reply; resolve its thread root instead`,
    );
  }

  const { data, error } = await client
    .from('comments')
    .update(
      resolved
        ? { resolved_at: new Date().toISOString(), resolved_by: userUuid }
        : { resolved_at: null, resolved_by: null },
    )
    .eq('uuid', uuid)
    .select('uuid');

  if (error) {
    console.error('Error resolving comment:', error);
    return failure(error.message);
  }
  if (!data?.length) return failure(REFUSED);

  return readWritten(client, uuid);
};

/**
 * `uuid` and everything the delete cascade takes with it. Walks with a visited
 * set, so a parent cycle yields a finite list rather than spinning.
 */
const descendantUuids = (uuid: string, rows: CommentDTO[]): string[] => {
  const childrenByParent = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parent_uuid) continue;
    const siblings = childrenByParent.get(row.parent_uuid);
    if (siblings) {
      siblings.push(row.uuid);
    } else {
      childrenByParent.set(row.parent_uuid, [row.uuid]);
    }
  }

  const collected = new Set<string>([uuid]);
  const queue = [uuid];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of childrenByParent.get(current) ?? []) {
      if (collected.has(child)) continue;
      collected.add(child);
      queue.push(child);
    }
  }

  return [...collected];
};

/**
 * Deletes a comment and, through the `parent_uuid` cascade, every reply below
 * it — including replies by other authors, which is the intended thread-level
 * delete. The `comment` annotation anchoring the thread is left alone; the
 * editor removes that mark through a normal passage save.
 */
export const deleteComment = async ({
  client,
  uuid,
  userUuid,
}: {
  client: DataClient;
  uuid: string;
  userUuid: string;
}): Promise<CommentDeleteResult> => {
  const refusal = (error: string): CommentDeleteResult => ({
    success: false,
    deletedUuids: [],
    error,
  });

  const existing = await readComment(client, uuid);
  if (existing.error) return refusal(existing.error);
  if (!existing.row) return refusal(`No comment found for ${uuid}`);

  if (existing.row.user_uuid !== userUuid) {
    return refusal('Permission denied: only the author can delete a comment');
  }

  const scopeRows = await readCommentRows(client, 'entity_uuid', [
    existing.row.entity_uuid,
  ]);
  if (!scopeRows) return refusal('Failed to read comment thread');

  const deletedUuids = descendantUuids(uuid, scopeRows);

  const { data, error } = await client
    .from('comments')
    .delete()
    .eq('uuid', uuid)
    .select('uuid');

  if (error) {
    console.error('Error deleting comment:', error);
    return refusal(error.message);
  }
  if (!data?.length) return refusal(REFUSED);

  return { success: true, deletedUuids };
};
