import DataLoader from 'dataloader';
import {
  getCommentAuthorProfiles,
  unknownCommentAuthor,
  type CommentAuthor,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for comment author identities, keyed by auth user id.
 *
 * This is what stops a thread of twenty replies from three people becoming
 * twenty profile reads. It takes no `ContentSource` because profiles are not
 * versioned content, and a published request never reaches it.
 *
 * An id with no profile — a deleted account, or a caller without `editor.read`
 * for whom the whole batch comes back empty — yields a generically named author
 * rather than null, so the non-null `Comment.author` holds.
 */
export function createCommentAuthorLoader(supabase: DataClient) {
  return new DataLoader<string, CommentAuthor>(async (ids) => {
    const authorsById = await getCommentAuthorProfiles({
      client: supabase,
      ids,
    });
    return ids.map((id) => authorsById.get(id) ?? unknownCommentAuthor(id));
  });
}
