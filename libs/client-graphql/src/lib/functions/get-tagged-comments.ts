import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_TAGGED_COMMENTS = gql`
  query GetTaggedComments($tag: String!, $workUuid: ID!) {
    taggedComments(tag: $tag, workUuid: $workUuid) {
      workUuid
      threadUuid
      passageUuids
    }
  }
`;

/**
 * Where a tagged comment sits in its work. Its body is not read: a caller
 * filtering to tagged threads reads those threads through the passage reads.
 */
export type TaggedCommentEntry = {
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
  }[];
};

/** Comments carrying `tag` in one work, oldest first. */
export async function getTaggedComments({
  client,
  tag,
  workUuid,
}: {
  client: GraphQLClient;
  tag: string;
  workUuid: string;
}): Promise<TaggedCommentEntry[]> {
  try {
    const response = await client.request<GetTaggedCommentsResponse>(
      GET_TAGGED_COMMENTS,
      { tag, workUuid },
    );

    return response.taggedComments.map(
      ({ workUuid, threadUuid, passageUuids }) => ({
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
