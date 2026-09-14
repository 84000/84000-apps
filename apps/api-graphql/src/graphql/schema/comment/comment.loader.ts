import DataLoader from 'dataloader';
import {
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
