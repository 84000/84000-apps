import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_GLOSSARY_TERM_INSTANCES = gql`
  query GetGlossaryTermInstances(
    $uuid: ID!
    $toh: String
    $first: Int
    $offset: Int
  ) {
    glossaryTermInstances(
      uuid: $uuid
      toh: $toh
      first: $first
      offset: $offset
    ) {
      items {
        uuid
        passageUuid
        passageLabel
        passageType
        passageSort
        start
        end
        before
        text
        after
        truncatedStart
        truncatedEnd
        outOfRange
      }
      totalCount
      offset
    }
  }
`;

/** One glossary-instance annotation citing a term, with the text it covers. */
export type GlossaryTermInstanceRow = {
  uuid: string;
  passageUuid: string;
  passageLabel: string | null;
  passageType: string;
  passageSort: number;
  start: number;
  end: number;
  before: string;
  text: string;
  after: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  /** The offsets fall outside the passage text. */
  outOfRange: boolean;
};

/** A page of the instances citing a glossary term. */
export type GlossaryTermInstancesPage = {
  items: GlossaryTermInstanceRow[];
  totalCount: number;
  offset: number;
};

type GetGlossaryTermInstancesResponse = {
  glossaryTermInstances: GlossaryTermInstancesPage | null;
};

/**
 * A page of the instances citing a glossary term, in passage order. Null when
 * the read fails.
 */
export async function getGlossaryTermInstances({
  client,
  uuid,
  toh,
  first = 50,
  offset = 0,
}: {
  client: GraphQLClient;
  uuid: string;
  toh?: string;
  first?: number;
  offset?: number;
}): Promise<GlossaryTermInstancesPage | null> {
  try {
    const response = await client.request<GetGlossaryTermInstancesResponse>(
      GET_GLOSSARY_TERM_INSTANCES,
      { uuid, toh, first, offset },
    );
    return response.glossaryTermInstances;
  } catch (error) {
    console.error('Error fetching glossary term instances:', error);
    return null;
  }
}
