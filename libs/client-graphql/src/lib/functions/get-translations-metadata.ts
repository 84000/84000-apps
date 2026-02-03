import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Work } from '@data-access';
import { worksFromGraphQL } from '../mappers';

const GET_ALL_WORKS = gql`
  query GetAllWorks {
    works {
      uuid
      title
      toh
      publicationDate
      publicationVersion
      pages
      restriction
      section
    }
  }
`;

type GetAllWorksResponse = {
  works: Array<{
    uuid: string;
    title: string;
    toh: string[];
    publicationDate: string;
    publicationVersion: string;
    pages: number;
    restriction: boolean;
    section: string;
  }>;
};

/**
 * Get metadata for all published translation works.
 */
export async function getTranslationsMetadata({
  client,
}: {
  client: GraphQLClient;
}): Promise<Work[]> {
  try {
    const response = await client.request<GetAllWorksResponse>(GET_ALL_WORKS);

    return worksFromGraphQL(response.works);
  } catch (error) {
    console.error('Error fetching translations metadata:', error);
    return [];
  }
}
