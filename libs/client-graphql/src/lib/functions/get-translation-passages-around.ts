import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { BodyItemType, PassagesPage } from '@data-access';
import { passagesPageFromGraphQL } from '../mappers';

const GET_PASSAGES_AROUND = gql`
  fragment AnnotationFields on Annotation {
    uuid
    type
    start
    end
    metadata
  }

  fragment AlignmentFields on Alignment {
    folioUuid
    toh
    tibetan
    folioNumber
    volumeNumber
  }

  fragment PassageWithAnnotations on Passage {
    uuid
    content
    label
    sort
    type
    xmlId
    annotations {
      ...AnnotationFields
    }
    alignments {
      ...AlignmentFields
    }
  }

  query GetPassagesAround(
    $uuid: ID!
    $cursor: String!
    $limit: Int
    $filter: PassageFilter
  ) {
    work(uuid: $uuid) {
      uuid
      passages(
        cursor: $cursor
        limit: $limit
        direction: AROUND
        filter: $filter
      ) {
        nodes {
          ...PassageWithAnnotations
        }
        nextCursor
        prevCursor
        hasMoreAfter
        hasMoreBefore
      }
    }
  }
`;

type GetPassagesAroundResponse = {
  work: {
    uuid: string;
    passages: {
      nodes: Array<{
        uuid: string;
        content: string;
        label: string;
        sort: number;
        type: string;
        xmlId?: string | null;
        annotations: Array<{
          uuid: string;
          type: string;
          start: number;
          end: number;
          metadata?: Record<string, unknown> | null;
        }>;
        alignments: Array<{
          folioUuid: string;
          toh: string;
          tibetan: string;
          folioNumber: number;
          volumeNumber: number;
        }>;
      }>;
      nextCursor?: string | null;
      prevCursor?: string | null;
      hasMoreAfter: boolean;
      hasMoreBefore: boolean;
    };
  } | null;
};

/**
 * Get passages around a specific passage UUID.
 *
 * NOTE: maxCharacters is not supported by the GraphQL API yet.
 * This parameter is accepted for API compatibility but is ignored.
 */
export async function getTranslationPassagesAround({
  client,
  uuid,
  passageUuid,
  type,
  maxPassages,
  maxCharacters: _maxCharacters,
}: {
  client: GraphQLClient;
  uuid: string;
  passageUuid: string;
  type?: BodyItemType;
  maxPassages?: number;
  maxCharacters?: number;
}): Promise<PassagesPage> {
  try {
    const response = await client.request<GetPassagesAroundResponse>(
      GET_PASSAGES_AROUND,
      {
        uuid,
        cursor: passageUuid,
        limit: maxPassages,
        filter: type ? { type } : undefined,
      },
    );

    if (!response.work) {
      return {
        passages: [],
        hasMoreAfter: false,
        hasMoreBefore: false,
      };
    }

    return passagesPageFromGraphQL(response.work.passages, response.work.uuid);
  } catch (error) {
    console.error('Error fetching translation passages around:', error);
    return {
      passages: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }
}
