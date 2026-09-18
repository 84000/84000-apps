import DataLoader from 'dataloader';
import {
  getAnchoredCommentUuids,
  getCommentsByEntityUuids,
  getCommentThreadsByAnchorUuids,
  type Comment,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for comment threads, keyed by the uuid a `comment`
 * annotation points at.
 *
 * Keyed on the anchor rather than the passage because `comments.entity_uuid` is
 * provenance, not position — see `getCommentThreadsByAnchorUuids`. Batching is
 * across the request: fifty passages carrying a hundred anchors cost one query.
 *
 * A key resolving to nothing yields null, so an anchor left behind by a deleted
 * thread drops out of the list instead of failing the field.
 */
export function createCommentThreadLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, Comment | null>(async (anchorUuids) => {
    const threadsByAnchor = await getCommentThreadsByAnchorUuids({
      client: supabase,
      anchorUuids,
      source,
    });
    return anchorUuids.map((uuid) => threadsByAnchor.get(uuid) ?? null);
  });
}

/**
 * Creates a DataLoader for the comment threads an entity holds, keyed by
 * `comments.entity_uuid`.
 *
 * Scope, not position — the companion to `commentThreadsByAnchorUuid`. A thread
 * is in an entity's scope for as long as it exists, which is what makes it
 * findable once no anchor places it any more.
 */
export function createCommentScopeLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, Comment[]>(async (entityUuids) => {
    const commentsByEntity = await getCommentsByEntityUuids({
      client: supabase,
      entityUuids,
      entityType: 'passage',
      source,
    });
    return entityUuids.map((uuid) => commentsByEntity.get(uuid) ?? []);
  });
}

/**
 * Creates a DataLoader answering whether a thread still has an anchor.
 *
 * Batched across the request: a page of passages asking about their own threads
 * costs one read, and the answer is work-wide rather than per passage, so a
 * thread whose anchor moved elsewhere is not mistaken for an unanchored one.
 */
export function createCommentAnchorLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, boolean>(async (commentUuids) => {
    const anchored = await getAnchoredCommentUuids({
      client: supabase,
      commentUuids,
      source,
    });
    return commentUuids.map((uuid) => anchored.has(uuid));
  });
}
