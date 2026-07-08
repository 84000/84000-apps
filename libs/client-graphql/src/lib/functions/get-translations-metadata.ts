import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Work } from '@eightyfourthousand/data-access';
import { worksFromGraphQL, type GraphQLWork } from '../mappers';

const GET_ALL_WORKS = gql`
  query GetAllWorks($cursor: String, $limit: Int) {
    works(cursor: $cursor, limit: $limit) {
      items {
        uuid
        title
        toh
        publicationDate
        publicationVersion
        pages
        restriction
        section
        imprint {
          mainTitles {
            tibetan
            wylie
            sanskrit
          }
        }
      }
      pageInfo {
        nextCursor
        hasMoreAfter
      }
    }
  }
`;

type GetAllWorksResponse = {
  works: {
    items: GraphQLWork[];
    pageInfo: {
      nextCursor: string | null;
      hasMoreAfter: boolean;
    };
  };
};

/**
 * Get metadata for all published translation works (fetches all pages).
 */
export async function getTranslationsMetadata({
  client,
  limit = 200,
}: {
  client: GraphQLClient;
  limit?: number;
}): Promise<Work[]> {
  try {
    const allWorks: GraphQLWork[] = [];
    let cursor: string | null = null;

    // Fetch all pages
    do {
      const response: GetAllWorksResponse =
        await client.request<GetAllWorksResponse>(GET_ALL_WORKS, {
          cursor,
          limit,
        });

      allWorks.push(...response.works.items);
      cursor = response.works.pageInfo.hasMoreAfter
        ? response.works.pageInfo.nextCursor
        : null;
    } while (cursor !== null);

    return worksFromGraphQL(allWorks);
  } catch (error) {
    console.error('Error fetching translations metadata:', error);
    return [];
  }
}
