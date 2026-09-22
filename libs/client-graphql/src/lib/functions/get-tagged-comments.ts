import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { commentFromGraphQL, type GraphQLComment } from '../mappers';
import { COMMENT_FIELDS_FRAGMENT } from './comment-fields';

const GET_TAGGED_COMMENTS = gql`
  ${COMMENT_FIELDS_FRAGMENT}

  query GetTaggedComments($tag: String!, $workUuid: ID) {
    taggedComments(tag: $tag, workUuid: $workUuid) {
      workUuid
      threadUuid
      passageUuids
      comment {
        ...CommentFields
      }
    }
  }
`;

/** A tagged comment, placed in its work and thread. */
export type TaggedCommentEntry = {
  comment: CommentThread;
  workUuid: string;
  /** The root of the comment's thread. Absent when its parent chain is broken. */
  threadUuid?: string;
  /** The passages anchoring the thread, or the one it was written on. */
  passageUuids: string[];
};

type GetTaggedCommentsResponse = {
  taggedComments: {
    workUuid: string;
    threadUuid?: string | null;
    passageUuids: string[];
    comment: GraphQLComment;
  }[];
};

/**
 * Comments carrying `tag`, oldest first, across the library or within one
 * work.
 */
export async function getTaggedComments({
  client,
  tag,
  workUuid,
}: {
  client: GraphQLClient;
  tag: string;
  workUuid?: string;
}): Promise<TaggedCommentEntry[]> {
  try {
    const response = await client.request<GetTaggedCommentsResponse>(
      GET_TAGGED_COMMENTS,
      { tag, workUuid },
    );

    return response.taggedComments.map(
      ({ comment, workUuid, threadUuid, passageUuids }) => ({
        comment: commentFromGraphQL(comment),
        workUuid,
        ...(threadUuid ? { threadUuid } : {}),
        passageUuids,
      }),
    );
  } catch (error) {
    console.error('Error fetching tagged comments:', error);
    return [];
  }
}
