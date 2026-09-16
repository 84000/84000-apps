import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import {
  COMMENT_THREAD_FRAGMENT,
  commentResultFromGraphQL,
  type CommentMutationResult,
  type GraphQLCommentResult,
} from './comment-fields';

const RESOLVE_COMMENT_MUTATION = gql`
  ${COMMENT_THREAD_FRAGMENT}

  mutation ResolveComment($uuid: ID!, $resolved: Boolean!) {
    resolveComment(uuid: $uuid, resolved: $resolved) {
      success
      error
      comment {
        ...CommentThreadFields
      }
    }
  }
`;

interface ResolveCommentResponse {
  resolveComment: GraphQLCommentResult;
}

/**
 * Resolve or un-resolve a thread, addressed by its root.
 * Requires editor.edit permission.
 */
export const resolveComment = async ({
  client,
  uuid,
  resolved,
}: {
  client: GraphQLClient;
  uuid: string;
  resolved: boolean;
}): Promise<CommentMutationResult> => {
  const response = await client.request<ResolveCommentResponse>(
    RESOLVE_COMMENT_MUTATION,
    { uuid, resolved },
  );

  return commentResultFromGraphQL(response.resolveComment);
};
