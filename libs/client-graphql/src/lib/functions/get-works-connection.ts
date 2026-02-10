import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Work } from '@data-access';

const GET_WORKS_CONNECTION = gql`
  query GetWorksConnection($cursor: String, $limit: Int) {
    worksConnection(cursor: $cursor, limit: $limit) {
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

type GetWorksConnectionResponse = {
  worksConnection: {
    items: GraphQLWork[];
    pageInfo: PageInfo;
    totalCount: number;
  };
};

export type WorksConnectionPage = {
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
export async function getWorksConnection({
  client,
  cursor,
  limit = 50,
}: {
  client: GraphQLClient;
  cursor?: string;
  limit?: number;
}): Promise<WorksConnectionPage> {
  try {
    const response = await client.request<GetWorksConnectionResponse>(
      GET_WORKS_CONNECTION,
      { cursor, limit },
    );

    return {
      items: response.worksConnection.items.map(workFromGraphQL),
      pageInfo: response.worksConnection.pageInfo,
      totalCount: response.worksConnection.totalCount,
    };
  } catch (error) {
    console.error('Error fetching works connection:', error);
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
