import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_TAGGED_COMMENT_WORKS = gql`
  query GetTaggedCommentWorks($tag: String!) {
    taggedCommentWorks(tag: $tag) {
      workUuid
      count
      latestAt
    }
  }
`;

/** One work's comments carrying a tag. */
export type TaggedCommentWorkEntry = {
  workUuid: string;
  count: number;
  /** When the newest of them was written. */
  latestAt: string;
};

type GetTaggedCommentWorksResponse = {
  taggedCommentWorks: TaggedCommentWorkEntry[];
};

/**
 * How many comments carry `tag` in each work, newest activity first. Reads no
 * comment bodies, so it suits a library-wide summary.
 */
export async function getTaggedCommentWorks({
  client,
  tag,
}: {
  client: GraphQLClient;
  tag: string;
}): Promise<TaggedCommentWorkEntry[]> {
  try {
    const response = await client.request<GetTaggedCommentWorksResponse>(
      GET_TAGGED_COMMENT_WORKS,
      { tag },
    );

    return response.taggedCommentWorks;
  } catch (error) {
    console.error('Error fetching tagged comment works:', error);
    return [];
  }
}
