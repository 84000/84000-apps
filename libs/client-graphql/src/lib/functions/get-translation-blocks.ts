import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type {
  BodyItemType,
  PaginationDirection,
  TranslationEditorContent,
  TranslationEditorContentItem,
} from '@data-access';

const GET_PASSAGES_WITH_JSON = gql`
  fragment PassageWithJson on Passage {
    uuid
    label
    sort
    type
    xmlId
    json
  }

  query GetPassagesWithJson(
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
          ...PassageWithJson
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

type PassageWithJson = {
  uuid: string;
  label: string;
  sort: number;
  type: string;
  xmlId?: string | null;
  json?: unknown | null;
};

type GetPassagesWithJsonResponse = {
  work: {
    uuid: string;
    passages: {
      nodes: PassageWithJson[];
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
 * Result of fetching translation blocks with pagination info
 */
export type TranslationBlocksPage = {
  blocks: TranslationEditorContent;
  nextCursor?: string;
  prevCursor?: string;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
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
 * Get paginated translation blocks (TipTap JSON) for a work.
 *
 * Unlike getTranslationPassages which returns Passage objects,
 * this function returns pre-transformed TipTap editor blocks
 * ready for rendering.
 */
export async function getTranslationBlocks({
  client,
  uuid,
  type,
  cursor,
  maxPassages = 100,
  direction,
}: {
  client: GraphQLClient;
  uuid: string;
  type?: BodyItemType | string;
  cursor?: string;
  maxPassages?: number;
  direction?: PaginationDirection;
}): Promise<TranslationBlocksPage> {
  try {
    const response = await client.request<GetPassagesWithJsonResponse>(
      GET_PASSAGES_WITH_JSON,
      {
        uuid,
        cursor,
        limit: maxPassages,
        direction: mapDirection(direction),
        filter: type ? { type } : undefined,
      },
    );

    if (!response.work) {
      return {
        blocks: [],
        hasMoreAfter: false,
        hasMoreBefore: false,
      };
    }

    const { passages } = response.work;

    // Extract the JSON blocks, filtering out any null values
    const blocks = passages.nodes
      .map((node) => node.json)
      .filter((json): json is TranslationEditorContentItem => json != null);

    return {
      blocks,
      nextCursor: passages.pageInfo.nextCursor ?? undefined,
      prevCursor: passages.pageInfo.prevCursor ?? undefined,
      hasMoreAfter: passages.pageInfo.hasMoreAfter,
      hasMoreBefore: passages.pageInfo.hasMoreBefore,
    };
  } catch (error) {
    console.error('Error fetching translation blocks:', error);
    return {
      blocks: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    };
  }
}
