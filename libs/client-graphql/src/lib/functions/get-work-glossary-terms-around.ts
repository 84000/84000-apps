import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { GlossaryTermInstance } from '@84000/data-access';
import type { GlossaryTermsPage } from './get-work-glossary-terms';

const GET_WORK_GLOSSARY_TERMS_AROUND = gql`
  query GetWorkGlossaryTermsAround(
    $uuid: ID!
    $cursor: String!
    $limit: Int
    $withAttestations: Boolean
  ) {
    work(uuid: $uuid) {
      glossaryTerms(
        cursor: $cursor
        limit: $limit
        direction: AROUND
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

type GetWorkGlossaryTermsAroundResponse = {
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
 * Get glossary terms around a specific term UUID.
 * Used for navigating to a glossary entry that hasn't been loaded yet.
 */
export async function getWorkGlossaryTermsAround({
  client,
  uuid,
  termUuid,
  limit,
  withAttestations = false,
}: {
  client: GraphQLClient;
  uuid: string;
  termUuid: string;
  limit?: number;
  withAttestations?: boolean;
}): Promise<GlossaryTermsPage> {
  try {
    const response = await client.request<GetWorkGlossaryTermsAroundResponse>(
      GET_WORK_GLOSSARY_TERMS_AROUND,
      {
        uuid,
        cursor: termUuid,
        limit,
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
    console.error('Error fetching glossary terms around:', error);
    return {
      terms: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
      totalCount: 0,
    };
  }
}
