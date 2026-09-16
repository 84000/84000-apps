import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import {
  COMMENT_THREAD_FRAGMENT,
  commentResultFromGraphQL,
  type CommentMutationResult,
  type GraphQLCommentResult,
} from './comment-fields';

const REPLY_TO_COMMENT_MUTATION = gql`
  ${COMMENT_THREAD_FRAGMENT}

  mutation ReplyToComment($parentUuid: ID!, $content: String!) {
    replyToComment(parentUuid: $parentUuid, content: $content) {
      success
      error
      comment {
        ...CommentThreadFields
      }
    }
  }
`;

interface ReplyToCommentResponse {
  replyToComment: GraphQLCommentResult;
}

/**
 * Reply to a comment. The reply inherits its parent's scope.
 * Requires editor.edit permission.
 */
export const replyToComment = async ({
  client,
  parentUuid,
  content,
}: {
  client: GraphQLClient;
  parentUuid: string;
  content: string;
}): Promise<CommentMutationResult> => {
  const response = await client.request<ReplyToCommentResponse>(
    REPLY_TO_COMMENT_MUTATION,
    { parentUuid, content },
  );

  return commentResultFromGraphQL(response.replyToComment);
};
