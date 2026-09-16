import {
  DEFAULT_THREAD_DEPTH,
  type CommentDTO,
  type Comment,
  type Comments,
  type DataClient,
  commentsFromDTO,
  threadsFromComments,
} from '../types';
import { DEFAULT_CONTENT_SOURCE, type ContentSource } from '../content-source';
import { readCommentRows } from './rows';

/**
 * Walks up to the root of the thread containing `uuid`, within rows already in
 * memory. Returns undefined if the chain leaves the set.
 *
 * `seen` guards against a parent cycle: nothing in the schema forbids one, and
 * following `parent_uuid` blindly would spin forever rather than return a wrong
 * answer.
 */
const rootOf = (
  uuid: string,
  byUuid: Map<string, CommentDTO>,
): CommentDTO | undefined => {
  const seen = new Set<string>([uuid]);
  let row = byUuid.get(uuid);

  while (row?.parent_uuid) {
    if (seen.has(row.parent_uuid)) return undefined;
    seen.add(row.parent_uuid);
    row = byUuid.get(row.parent_uuid);
  }

  return row;
};

/**
 * Threads addressed by the uuid a comment anchor points at, keyed by that uuid.
 *
 * The companion to `getCommentsByEntityUuids`, and the one a per-passage read
 * should use. The two halves of a thread's identity are read from different
 * places on purpose: `entity_uuid` is scope — which entity a thread belongs to,
 * shared by every comment in it — while the anchor is position. A split moves
 * the anchor and leaves `entity_uuid` behind, so reading position from scope
 * shows a thread on the wrong passage and hides it from the right one.
 *
 * That division is what makes this two fixed queries rather than one per level:
 * resolve each anchor to its scope, then read the scope whole and assemble in
 * memory. An anchor naming a reply — which nothing prevents, the annotation
 * content being jsonb with no foreign key — costs nothing extra, because its
 * root is already in the set.
 *
 * `maxDepth` bounds the response, not the data. A truncated comment still
 * reports its true `replyCount`, so a caller can fetch the rest of a branch.
 */
export const getCommentThreadsByAnchorUuids = async ({
  client,
  anchorUuids,
  source = DEFAULT_CONTENT_SOURCE,
  maxDepth = DEFAULT_THREAD_DEPTH,
}: {
  client: DataClient;
  anchorUuids: readonly string[];
  source?: ContentSource;
  maxDepth?: number;
}): Promise<Map<string, Comment>> => {
  const threadsByAnchor = new Map<string, Comment>();

  if (source === 'published' || anchorUuids.length === 0) {
    return threadsByAnchor;
  }

  const anchorRows = await readCommentRows(client, 'uuid', anchorUuids);
  if (!anchorRows) return new Map();

  const scopes = [...new Set(anchorRows.map((row) => row.entity_uuid))];
  if (scopes.length === 0) return threadsByAnchor;

  const scopeRows = await readCommentRows(client, 'entity_uuid', scopes);
  if (!scopeRows) return new Map();

  const byUuid = new Map(scopeRows.map((row) => [row.uuid, row]));

  // One tree build over the whole set, then a lookup per anchor — rather than a
  // build per anchor, which would repeat the work for every anchor of a thread.
  const threadsByRoot = new Map<string, Comment>();
  for (const thread of threadsFromComments(
    commentsFromDTO(scopeRows),
    maxDepth,
  )) {
    threadsByRoot.set(thread.uuid, thread);
  }

  for (const anchorUuid of anchorUuids) {
    const root = rootOf(anchorUuid, byUuid);
    const thread = root && threadsByRoot.get(root.uuid);
    if (thread) threadsByAnchor.set(anchorUuid, thread);
  }

  return threadsByAnchor;
};

/**
 * One thread, addressed by any comment in it, with replies nested from that
 * comment down. How a client fetches the rest of a branch a shallower read
 * truncated.
 */
export const getCommentThreadByUuid = async ({
  client,
  uuid,
  source = DEFAULT_CONTENT_SOURCE,
  maxDepth = DEFAULT_THREAD_DEPTH,
}: {
  client: DataClient;
  uuid: string;
  source?: ContentSource;
  maxDepth?: number;
}): Promise<Comment | null> => {
  if (source === 'published') return null;

  const [row] = (await readCommentRows(client, 'uuid', [uuid])) ?? [];
  if (!row) return null;

  const scopeRows = await readCommentRows(client, 'entity_uuid', [
    row.entity_uuid,
  ]);
  if (!scopeRows) return null;

  // Built from this comment down rather than from the thread root, so the
  // caller gets the branch it asked about at full depth.
  const subtree: Comments = commentsFromDTO(scopeRows).map((comment) =>
    comment.uuid === uuid ? { ...comment, parentUuid: undefined } : comment,
  );

  const [thread] = threadsFromComments(subtree, maxDepth).filter(
    (candidate) => candidate.uuid === uuid,
  );

  return thread ?? null;
};
