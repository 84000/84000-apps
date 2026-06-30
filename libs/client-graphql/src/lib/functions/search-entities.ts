import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const SEARCH_ENTITIES = gql`
  query SearchEntities(
    $query: String!
    $workUuid: ID
    $toh: String
    $types: [String!]
    $limit: Int
  ) {
    search(
      query: $query
      workUuid: $workUuid
      toh: $toh
      types: $types
      limit: $limit
    ) {
      uuid
      type
      label
      text
    }
  }
`;

export type EntitySearchResultType =
  | 'work'
  | 'passage'
  | 'folio'
  | 'bibliography'
  | 'glossary';

export type EntitySearchResult = {
  uuid: string;
  type: EntitySearchResultType;
  label: string;
  text: string;
};

type SearchEntitiesResponse = {
  search: EntitySearchResult[];
};

export async function searchEntities({
  client,
  query,
  workUuid,
  toh,
  types,
  limit = 20,
}: {
  client: GraphQLClient;
  query: string;
  workUuid?: string;
  toh?: string;
  types?: EntitySearchResultType[];
  limit?: number;
}): Promise<EntitySearchResult[]> {
  try {
    const response = await client.request<SearchEntitiesResponse>(
      SEARCH_ENTITIES,
      { query, workUuid, toh, types, limit },
    );

    return response.search ?? [];
  } catch (error) {
    console.error(`Failed to search entities: ${error}`);
    return [];
  }
}
