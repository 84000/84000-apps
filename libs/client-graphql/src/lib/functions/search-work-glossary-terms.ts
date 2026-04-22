import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const SEARCH_WORK_GLOSSARY_TERMS = gql`
  query SearchWorkGlossaryTerms(
    $uuid: ID!
    $query: String!
    $limit: Int
    $withAttestations: Boolean
  ) {
    work(uuid: $uuid) {
      uuid
      searchGlossaryTerms(
        query: $query
        limit: $limit
        withAttestations: $withAttestations
      ) {
        uuid
        authority
        names {
          english
          tibetan
          wylie
        }
      }
    }
  }
`;

export type GlossaryTermSearchResult = {
  uuid: string;
  authority: string;
  names: {
    english: string | null;
    tibetan: string | null;
    wylie: string | null;
  };
};

type SearchWorkGlossaryTermsResponse = {
  work: {
    searchGlossaryTerms: GlossaryTermSearchResult[];
  } | null;
};

export async function searchWorkGlossaryTerms({
  client,
  uuid,
  query,
  limit = 20,
  withAttestations = false,
}: {
  client: GraphQLClient;
  uuid: string;
  query: string;
  limit?: number;
  withAttestations?: boolean;
}): Promise<GlossaryTermSearchResult[]> {
  try {
    const response = await client.request<SearchWorkGlossaryTermsResponse>(
      SEARCH_WORK_GLOSSARY_TERMS,
      { uuid, query, limit, withAttestations },
    );

    return response.work?.searchGlossaryTerms ?? [];
  } catch (error) {
    console.error(`Failed to search work glossary terms: ${error}`);
    return [];
  }
}
