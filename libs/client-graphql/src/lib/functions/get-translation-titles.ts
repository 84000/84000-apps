import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Titles } from '@data-access';
import { titlesFromGraphQL } from '../mappers';

const GET_WORK_TITLES = gql`
  query GetWorkWithTitles($uuid: ID!) {
    work(uuid: $uuid) {
      titles {
        uuid
        content
        language
        type
      }
    }
  }
`;

type GetWorkTitlesResponse = {
  work: {
    titles: Array<{
      uuid: string;
      content: string;
      language: string;
      type: string;
    }>;
  } | null;
};

/**
 * Get all titles for a work.
 */
export async function getTranslationTitles({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<Titles> {
  try {
    const response = await client.request<GetWorkTitlesResponse>(
      GET_WORK_TITLES,
      { uuid },
    );

    if (!response.work) {
      return [];
    }

    return titlesFromGraphQL(response.work.titles);
  } catch (error) {
    console.error('Error fetching translation titles:', error);
    return [];
  }
}
