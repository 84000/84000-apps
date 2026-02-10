import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  BodyItemType,
  PaginationDirection,
  PassagesPage,
} from '@data-access';
import { passagesPageFromGraphQL } from '../mappers';

const GET_PASSAGES = gql`
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
    workUuid
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

  query GetPassages(
    $uuid: ID!
    $cursor: String
    $limit: Int
    $direction: PaginationDirection
    $filter: PassageFilter
  ) {
    work(uuid: $uuid) {
      uuid
      passages(
        cursor: $cursor
        limit: $limit
        direction: $direction
        filter: $filter
      ) {
        nodes {
          ...PassageWithAnnotations
        }
        pageInfo {
          nextCursor
          prevCursor
          hasMoreAfter
          hasMoreBefore
        }
      }
    }
  }
`;

type GetPassagesResponse = {
  work: {
    uuid: string;
    passages: {
      nodes: Array<{
        uuid: string;
        workUuid: string;
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
      pageInfo: {
        nextCursor?: string | null;
        prevCursor?: string | null;
        hasMoreAfter: boolean;
        hasMoreBefore: boolean;
      };
    };
  } | null;
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
 * Get paginated passages for a translation work.
 *
 * NOTE: maxCharacters is not supported by the GraphQL API yet.
 * This parameter is accepted for API compatibility but is ignored.
 */
export async function getTranslationPassages({
  client,
  uuid,
  type,
  cursor,
  maxPassages = 100,
  maxCharacters: _maxCharacters,
  direction,
}: {
  client: GraphQLClient;
  uuid: string;
  type?: BodyItemType;
  cursor?: string;
  maxPassages?: number;
  maxCharacters?: number;
  direction?: PaginationDirection;
}): Promise<PassagesPage> {
  try {
    const response = await client.request<GetPassagesResponse>(GET_PASSAGES, {
      uuid,
      cursor,
      limit: maxPassages,
      direction: mapDirection(direction),
      filter: type ? { type } : undefined,
    });

    if (!response.work) {
      return {
        passages: [],
        hasMoreAfter: false,
        hasMoreBefore: false,
      };
    }

    return passagesPageFromGraphQL(response.work.passages, response.work.uuid);
  } catch (error) {
    console.error('Error fetching translation passages:', error);
    return {
      passages: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }
}
