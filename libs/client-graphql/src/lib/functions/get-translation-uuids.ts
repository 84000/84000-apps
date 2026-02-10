import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_WORK_UUIDS = gql`
  query GetWorkUuids($cursor: String, $limit: Int) {
    works(cursor: $cursor, limit: $limit) {
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

/**
 * Get all work UUIDs (fetches all pages).
 */
export async function getTranslationUuids({
  client,
}: {
  client: GraphQLClient;
}): Promise<string[]> {
  try {
    const allUuids: string[] = [];
    let cursor: string | null = null;

    // Fetch all pages
    do {
      const response: GetWorkUuidsResponse =
        await client.request<GetWorkUuidsResponse>(GET_WORK_UUIDS, {
          cursor,
          limit: 200,
        });

      allUuids.push(...response.works.items.map((w) => w.uuid));
      cursor = response.works.pageInfo.hasMoreAfter
        ? response.works.pageInfo.nextCursor
        : null;
    } while (cursor !== null);

    return allUuids;
  } catch (error) {
    console.error('Error fetching translation UUIDs:', error);
    return [];
  }
}
