import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_GLOSSARY_TERM_EXCERPTS = gql`
  query GetGlossaryTermExcerpts(
    $uuid: ID!
    $toh: String
    $first: Int
    $after: String
  ) {
    glossaryTermExcerpts(uuid: $uuid, toh: $toh, first: $first, after: $after) {
      items {
        uuid
        label
        type
        sort
        toh
        instanceCount
        text
        truncatedStart
        truncatedEnd
        highlights {
          start
          end
        }
      }
      totalCount
      nextCursor
      hasMore
    }
  }
`;

/** A passage citing a glossary term, with an excerpt around its first instance. */
export type GlossaryPassageExcerpt = {
  uuid: string;
  label: string | null;
  type: string;
  sort: number;
  toh: string | null;
  instanceCount: number;
  text: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  highlights: Array<{ start: number; end: number }>;
};

/** A page of the passages citing a glossary term. */
export type GlossaryExcerptsPage = {
  items: GlossaryPassageExcerpt[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};

type GetGlossaryTermExcerptsResponse = {
  glossaryTermExcerpts: GlossaryExcerptsPage | null;
};

/**
 * A page of the passages citing a glossary term, one per passage. Null when
 * the read fails.
 */
export async function getGlossaryTermExcerpts({
  client,
  uuid,
  toh,
  first = 20,
  after,
}: {
  client: GraphQLClient;
  uuid: string;
  toh?: string;
  first?: number;
  after?: string | null;
}): Promise<GlossaryExcerptsPage | null> {
  try {
    const response = await client.request<GetGlossaryTermExcerptsResponse>(
      GET_GLOSSARY_TERM_EXCERPTS,
      { uuid, toh, first, after },
    );
    return response.glossaryTermExcerpts;
  } catch (error) {
    console.error('Error fetching glossary term excerpts:', error);
    return null;
  }
}
