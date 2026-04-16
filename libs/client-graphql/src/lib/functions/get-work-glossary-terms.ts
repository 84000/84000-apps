import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  GlossaryTermInstance,
  PaginationDirection,
} from '@eightyfourthousand/data-access';

const GET_WORK_GLOSSARY_TERMS = gql`
  query GetWorkGlossaryTerms(
    $uuid: ID!
    $cursor: String
    $limit: Int
    $direction: PaginationDirection
    $withAttestations: Boolean
  ) {
    work(uuid: $uuid) {
      glossaryTerms(
        cursor: $cursor
        limit: $limit
        direction: $direction
        withAttestations: $withAttestations
      ) {
        nodes {
          uuid
          authority
          definition
          termNumber
          names {
            english
            tibetan
            sanskrit
            pali
            chinese
            wylie
            alternatives
          }
          passages(first: 10) {
            items {
              uuid
              type
              label
            }
            nextCursor
            hasMore
          }
        }
        pageInfo {
          nextCursor
          prevCursor
          hasMoreAfter
          hasMoreBefore
        }
        totalCount
      }
    }
  }
`;

type GetWorkGlossaryTermsResponse = {
  work: {
    glossaryTerms: {
      nodes: GlossaryTermInstance[];
      pageInfo: {
        nextCursor?: string | null;
        prevCursor?: string | null;
        hasMoreAfter: boolean;
        hasMoreBefore: boolean;
      };
      totalCount: number;
    };
  } | null;
};

/**
 * Result of fetching glossary terms with pagination info
 */
export type GlossaryTermsPage = {
  terms: GlossaryTermInstance[];
  nextCursor?: string;
  prevCursor?: string;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  totalCount: number;
};

/**
 * Map internal pagination direction to GraphQL enum
 */
function mapDirection(
  direction?: PaginationDirection,
): 'FORWARD' | 'BACKWARD' | undefined {
  if (!direction) return undefined;
  return direction === 'forward' ? 'FORWARD' : 'BACKWARD';
}

/**
 * Get paginated glossary terms for a work.
 */
export async function getWorkGlossaryTerms({
  client,
  uuid,
  cursor,
  limit = 50,
  direction,
  withAttestations = false,
}: {
  client: GraphQLClient;
  uuid: string;
  cursor?: string;
  limit?: number;
  direction?: PaginationDirection;
  withAttestations?: boolean;
}): Promise<GlossaryTermsPage> {
  try {
    const response = await client.request<GetWorkGlossaryTermsResponse>(
      GET_WORK_GLOSSARY_TERMS,
      {
        uuid,
        cursor,
        limit,
        direction: mapDirection(direction),
        withAttestations,
      },
    );

    if (!response.work) {
      return {
        terms: [],
        hasMoreAfter: false,
        hasMoreBefore: false,
        totalCount: 0,
      };
    }

    const { glossaryTerms } = response.work;

    return {
      terms: glossaryTerms.nodes,
      nextCursor: glossaryTerms.pageInfo.nextCursor ?? undefined,
      prevCursor: glossaryTerms.pageInfo.prevCursor ?? undefined,
      hasMoreAfter: glossaryTerms.pageInfo.hasMoreAfter,
      hasMoreBefore: glossaryTerms.pageInfo.hasMoreBefore,
      totalCount: glossaryTerms.totalCount,
    };
  } catch (error) {
    console.error('Error fetching work glossary terms:', error);
    return {
      terms: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
      totalCount: 0,
    };
  }
}
