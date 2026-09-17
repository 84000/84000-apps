import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import {
  COMMENT_THREAD_FRAGMENT,
  commentResultFromGraphQL,
  type CommentMutationResult,
  type GraphQLCommentResult,
} from './comment-fields';

const UPDATE_COMMENT_MUTATION = gql`
  ${COMMENT_THREAD_FRAGMENT}

  mutation UpdateComment($uuid: ID!, $content: String!) {
    updateComment(uuid: $uuid, content: $content) {
      success
      error
      comment {
        ...CommentThreadFields
      }
    }
  }
`;

interface UpdateCommentResponse {
  updateComment: GraphQLCommentResult;
}

/**
 * Edit a comment's body. The author only.
 * Requires editor.edit permission.
 */
export const updateComment = async ({
  client,
  uuid,
  content,
}: {
  client: GraphQLClient;
  uuid: string;
  content: string;
}): Promise<CommentMutationResult> => {
  const response = await client.request<UpdateCommentResponse>(
    UPDATE_COMMENT_MUTATION,
    { uuid, content },
  );

  return commentResultFromGraphQL(response.updateComment);
};
