import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const GET_WORK_UUIDS = gql`
  query GetWorkUuids {
    works {
      uuid
    }
  }
`;

type GetWorkUuidsResponse = {
  works: Array<{
    uuid: string;
  }>;
};

/**
 * Get all work UUIDs.
 */
export async function getTranslationUuids({
  client,
}: {
  client: GraphQLClient;
}): Promise<string[]> {
  try {
    const response = await client.request<GetWorkUuidsResponse>(GET_WORK_UUIDS);

    return response.works.map((w) => w.uuid);
  } catch (error) {
    console.error('Error fetching translation UUIDs:', error);
    return [];
  }
}
