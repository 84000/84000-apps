import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Folio } from '@data-access';

const GET_WORK_FOLIOS = gql`
  query GetWorkFolios($uuid: ID!, $toh: String!, $page: Int, $size: Int) {
    work(uuid: $uuid) {
      folios(toh: $toh, page: $page, size: $size) {
        uuid
        content
        volume
        folio
        side
      }
    }
  }
`;

type GetWorkFoliosResponse = {
  work: {
    folios: Folio[];
  } | null;
};

/**
 * Get folios for a specific work, filtered by toh and paginated.
 */
export async function getWorkFolios({
  client,
  uuid,
  toh,
  page = 0,
  size = 10,
}: {
  client: GraphQLClient;
  uuid: string;
  toh: string;
  page?: number;
  size?: number;
}): Promise<Folio[]> {
  try {
    const response = await client.request<GetWorkFoliosResponse>(
      GET_WORK_FOLIOS,
      { uuid, toh, page, size },
    );

    return response.work?.folios ?? [];
  } catch (error) {
    console.error('Error fetching work folios:', error);
    return [];
  }
}
