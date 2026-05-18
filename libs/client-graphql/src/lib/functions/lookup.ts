import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

export type LookupEntityType = 'work' | 'passage' | 'glossary' | 'bibliography';

export type LookupResult = {
  uuid: string;
  type: LookupEntityType;
};

const LOOKUP = gql`
  query Lookup(
    $toh: String
    $uuid: ID
    $xmlId: String
    $type: LookupEntityType
  ) {
    lookup(toh: $toh, uuid: $uuid, xmlId: $xmlId, type: $type) {
      uuid
      type
    }
  }
`;

type LookupResponse = {
  lookup: LookupResult | null;
};

export async function lookup({
  client,
  toh,
  uuid,
  xmlId,
  type,
}: {
  client: GraphQLClient;
  toh?: string;
  uuid?: string;
  xmlId?: string;
  type?: LookupEntityType;
}): Promise<LookupResult | null> {
  try {
    const response = await client.request<LookupResponse>(LOOKUP, {
      toh,
      uuid,
      xmlId,
      type,
    });

    return response.lookup;
  } catch (error) {
    console.error('Error looking up entity:', error);
    return null;
  }
}
