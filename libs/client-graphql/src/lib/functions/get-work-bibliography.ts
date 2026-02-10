import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { BibliographyEntries } from '@data-access';

const GET_WORK_BIBLIOGRAPHY = gql`
  query GetWorkBibliography($uuid: ID!) {
    work(uuid: $uuid) {
      bibliography {
        heading
        entries {
          uuid
          html
          workUuid
        }
      }
    }
  }
`;

type GetWorkBibliographyResponse = {
  work: {
    bibliography: BibliographyEntries;
  } | null;
};

/**
 * Get bibliography entries for a specific work.
 */
export async function getWorkBibliography({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<BibliographyEntries> {
  try {
    const response = await client.request<GetWorkBibliographyResponse>(
      GET_WORK_BIBLIOGRAPHY,
      { uuid },
    );

    return response.work?.bibliography ?? [];
  } catch (error) {
    console.error('Error fetching work bibliography:', error);
    return [];
  }
}
