import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_TERM_PASSAGES = gql`
  query GetTermPassages($uuid: ID!, $first: Int, $after: String) {
    glossaryTermPassages(uuid: $uuid, first: $first, after: $after) {
      items {
        uuid
        type
        label
        sort
      }
      nextCursor
      hasMore
    }
  }
`;

export type GlossaryPassagesPage = {
  items: Array<{ uuid: string; type: string; label: string; sort: number }>;
  nextCursor: string | null;
  hasMore: boolean;
};

type GetTermPassagesResponse = {
  glossaryTermPassages: GlossaryPassagesPage;
};

/**
 * Fetch a page of passage references for a single glossary term instance.
 */
export async function getTermPassages({
  client,
  uuid,
  first = 10,
  after,
}: {
  client: GraphQLClient;
  uuid: string;
  first?: number;
  after?: string;
}): Promise<GlossaryPassagesPage> {
  try {
    const response = await client.request<GetTermPassagesResponse>(
      GET_TERM_PASSAGES,
      { uuid, first, after },
    );
    return response.glossaryTermPassages;
  } catch (error) {
    console.error('Error fetching term passages:', error);
    return { items: [], nextCursor: null, hasMore: false };
  }
}
