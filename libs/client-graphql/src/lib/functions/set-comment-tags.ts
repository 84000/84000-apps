import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import {
  COMMENT_THREAD_FRAGMENT,
  commentResultFromGraphQL,
  type CommentMutationResult,
  type GraphQLCommentResult,
} from './comment-fields';

const SET_COMMENT_TAGS_MUTATION = gql`
  ${COMMENT_THREAD_FRAGMENT}

  mutation SetCommentTags($uuid: ID!, $tags: [String!]!) {
    setCommentTags(uuid: $uuid, tags: $tags) {
      success
      error
      comment {
        ...CommentThreadFields
      }
    }
  }
`;

interface SetCommentTagsResponse {
  setCommentTags: GraphQLCommentResult;
}

/**
 * Replace a comment's tags, root or reply.
 * Requires editor.edit permission.
 */
export const setCommentTags = async ({
  client,
  uuid,
  tags,
}: {
  client: GraphQLClient;
  uuid: string;
  tags: string[];
}): Promise<CommentMutationResult> => {
  const response = await client.request<SetCommentTagsResponse>(
    SET_COMMENT_TAGS_MUTATION,
    { uuid, tags },
  );

  return commentResultFromGraphQL(response.setCommentTags);
};
