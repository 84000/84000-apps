import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Work } from '@data-access';

const GET_WORKS = gql`
  query GetWorks($cursor: String, $limit: Int) {
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
`;

type GraphQLWork = {
  uuid: string;
  title: string;
  toh: string[];
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  section: string;
};

type PageInfo = {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

type GetWorksResponse = {
  works: {
    items: GraphQLWork[];
    pageInfo: PageInfo;
    totalCount: number;
  };
};

export type WorksPage = {
  items: Work[];
  pageInfo: PageInfo;
  totalCount: number;
};

function workFromGraphQL(gqlWork: GraphQLWork): Work {
  return {
    uuid: gqlWork.uuid,
    title: gqlWork.title,
    toh: gqlWork.toh as Work['toh'],
    publicationDate: new Date(gqlWork.publicationDate),
    publicationVersion:
      gqlWork.publicationVersion as Work['publicationVersion'],
    pages: gqlWork.pages,
    restriction: gqlWork.restriction,
    section: gqlWork.section,
  };
}

/**
 * Get paginated works.
 */
export async function getWorks({
  client,
  cursor,
  limit = 50,
}: {
  client: GraphQLClient;
  cursor?: string;
  limit?: number;
}): Promise<WorksPage> {
  try {
    const response = await client.request<GetWorksResponse>(GET_WORKS, {
      cursor,
      limit,
    });

    return {
      items: response.works.items.map(workFromGraphQL),
      pageInfo: response.works.pageInfo,
      totalCount: response.works.totalCount,
    };
  } catch (error) {
    console.error('Error fetching works:', error);
    return {
      items: [],
      pageInfo: {
        nextCursor: null,
        prevCursor: null,
        hasMoreAfter: false,
        hasMoreBefore: false,
      },
      totalCount: 0,
    };
  }
}
