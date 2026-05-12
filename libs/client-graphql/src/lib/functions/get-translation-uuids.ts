import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;

const GET_WORK_UUIDS = gql`
  query GetWorkUuids($cursor: String, $limit: Int, $filter: WorkFilter) {
    works(cursor: $cursor, limit: $limit, filter: $filter) {
      items {
        uuid
      }
      pageInfo {
        nextCursor
        hasMoreAfter
      }
    }
  }
`;

type GetWorkUuidsResponse = {
  works: {
    items: Array<{ uuid: string }>;
    pageInfo: {
      nextCursor: string | null;
      hasMoreAfter: boolean;
    };
  };
};

type WorkFilter = {
  maxPages?: number;
};

/**
 * Get work UUIDs with optional filtering.
 * @param client - GraphQL client
 * @param filter - Optional filter criteria (e.g., maxPages)
 * @param limit - Optional limit on total results (fetches all pages if not specified)
 */
export async function getTranslationUuids({
  client,
  filter,
  limit,
}: {
  client: GraphQLClient;
  filter?: WorkFilter;
  limit?: number;
}): Promise<string[]> {
  try {
    const uuids: string[] = [];
    const effectiveLimit = limit
      ? Math.min(limit, MAX_PAGE_SIZE)
      : MAX_PAGE_SIZE;
    let cursor: string | null = null;

    do {
      const pageLimit = limit
        ? Math.min(DEFAULT_PAGE_SIZE, effectiveLimit - uuids.length)
        : DEFAULT_PAGE_SIZE;

      const response: GetWorkUuidsResponse =
        await client.request<GetWorkUuidsResponse>(GET_WORK_UUIDS, {
          cursor,
          limit: pageLimit,
          filter,
        });

      uuids.push(...response.works.items.map((w) => w.uuid));

      cursor = response.works.pageInfo.hasMoreAfter
        ? response.works.pageInfo.nextCursor
        : null;
    } while (cursor && uuids.length < effectiveLimit);

    return uuids.slice(0, effectiveLimit);
  } catch (error) {
    console.error('Error fetching translation UUIDs:', error);
    return [];
  }
}
