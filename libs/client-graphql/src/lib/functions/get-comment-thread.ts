import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { commentFromGraphQL, type GraphQLComment } from '../mappers';
import { COMMENT_THREAD_FRAGMENT } from './comment-fields';

const GET_COMMENT_THREAD = gql`
  ${COMMENT_THREAD_FRAGMENT}

  query GetCommentThread($uuid: ID!, $depth: Int) {
    comment(uuid: $uuid, depth: $depth) {
      ...CommentThreadFields
    }
  }
`;

type GetCommentThreadResponse = {
  comment: GraphQLComment | null;
};

/**
 * One thread read from any comment in it, replies nested from there down.
 *
 * How a client opens the rest of a branch a shallower read truncated: compare a
 * comment's `replyCount` against the replies it carries, and read from that
 * comment.
 */
export async function getCommentThread({
  client,
  uuid,
  depth,
}: {
  client: GraphQLClient;
  uuid: string;
  depth?: number;
}): Promise<CommentThread | undefined> {
  try {
    const response = await client.request<GetCommentThreadResponse>(
      GET_COMMENT_THREAD,
      { uuid, depth },
    );

    return response.comment ? commentFromGraphQL(response.comment) : undefined;
  } catch (error) {
    console.error('Error fetching comment thread:', error);
    return undefined;
  }
}
