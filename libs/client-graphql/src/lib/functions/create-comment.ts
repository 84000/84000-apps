import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import {
  COMMENT_THREAD_FRAGMENT,
  commentResultFromGraphQL,
  type CommentMutationResult,
  type GraphQLCommentResult,
} from './comment-fields';

const CREATE_COMMENT_MUTATION = gql`
  ${COMMENT_THREAD_FRAGMENT}

  mutation CreateComment($input: CreateCommentInput!) {
    createComment(input: $input) {
      success
      error
      comment {
        ...CommentThreadFields
      }
    }
  }
`;

interface CreateCommentResponse {
  createComment: GraphQLCommentResult;
}

/**
 * Start a comment thread on an entity.
 * Requires editor.edit permission.
 */
export const createComment = async ({
  client,
  entityUuid,
  entityType,
  content,
}: {
  client: GraphQLClient;
  entityUuid: string;
  entityType: string;
  content: string;
}): Promise<CommentMutationResult> => {
  const response = await client.request<CreateCommentResponse>(
    CREATE_COMMENT_MUTATION,
    { input: { entityUuid, entityType, content } },
  );

  return commentResultFromGraphQL(response.createComment);
};
