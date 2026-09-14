import {
  type CommentAuthor,
  type CommentAuthorDTO,
  type DataClient,
  commentAuthorFromDTO,
} from '../types';

/**
 * Comment author identities, keyed by auth user id.
 *
 * Read through the `comment_author_profiles` definer function, not
 * `user_profiles`: the table's only SELECT policy is self-read, so a direct
 * select through the requesting user's client returns the caller's own row and
 * nothing else. The function checks `editor.read` itself and returns identity
 * columns only.
 *
 * Shaped for a DataLoader: one call per batch of ids.
 */
export const getCommentAuthorProfiles = async ({
  client,
  ids,
}: {
  client: DataClient;
  ids: readonly string[];
}): Promise<Map<string, CommentAuthor>> => {
  const authorsById = new Map<string, CommentAuthor>();

  if (ids.length === 0) {
    return authorsById;
  }

  const { data, error } = await client.rpc('comment_author_profiles', {
    p_ids: [...new Set(ids)],
  });

  if (error) {
    // Includes the permission denial the function raises for a caller without
    // `editor.read`. An empty map renders every author as unknown, which is the
    // right outcome for a reader who should not be seeing names.
    console.error('Error resolving comment authors:', error);
    return authorsById;
  }

  for (const row of (data ?? []) as CommentAuthorDTO[]) {
    authorsById.set(row.id, commentAuthorFromDTO(row));
  }

  return authorsById;
};
