import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const DELETE_COMMENT_MUTATION = gql`
  mutation DeleteComment($uuid: ID!) {
    deleteComment(uuid: $uuid) {
      success
      deletedUuids
      error
    }
  }
`;

/**
 * The outcome of a delete. `deletedUuids` names the comment together with every
 * reply that cascaded with it, so a panel can drop them all without refetching.
 */
export interface DeleteCommentResult {
  success: boolean;
  deletedUuids: string[];
  error?: string;
}

interface DeleteCommentResponse {
  deleteComment: {
    success: boolean;
    deletedUuids: string[];
    error?: string | null;
  };
}

/**
 * Delete a comment and every reply below it. The author only.
 *
 * Leaves the `comment` annotation anchoring the thread in place — the editor
 * removes that mark through a normal passage save.
 * Requires editor.edit permission.
 */
export const deleteComment = async ({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<DeleteCommentResult> => {
  const response = await client.request<DeleteCommentResponse>(
    DELETE_COMMENT_MUTATION,
    { uuid },
  );

  const { success, deletedUuids, error } = response.deleteComment;

  return { success, deletedUuids, ...(error ? { error } : {}) };
};
