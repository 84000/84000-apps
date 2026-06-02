import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { FoliosAround } from '@eightyfourthousand/data-access';

const GET_WORK_FOLIOS_AROUND = gql`
  query GetWorkFoliosAround(
    $uuid: ID!
    $toh: String!
    $folioUuid: ID!
    $before: Int
    $after: Int
  ) {
    work(uuid: $uuid) {
      foliosAround(
        toh: $toh
        folioUuid: $folioUuid
        before: $before
        after: $after
      ) {
        folios {
          uuid
          content
          volume
          folio
          side
        }
        startIndex
        hasMoreBefore
        hasMoreAfter
      }
    }
  }
`;

type GetWorkFoliosAroundResponse = {
  work: {
    foliosAround: FoliosAround | null;
  } | null;
};

/**
 * Get a window of folios centered on a target folio, for deep-linking into
 * the source reader. Returns `null` when the folio isn't part of the work/toh.
 */
export async function getWorkFoliosAround({
  client,
  uuid,
  toh,
  folioUuid,
  before,
  after,
}: {
  client: GraphQLClient;
  uuid: string;
  toh: string;
  folioUuid: string;
  before?: number;
  after?: number;
}): Promise<FoliosAround | null> {
  try {
    const response = await client.request<GetWorkFoliosAroundResponse>(
      GET_WORK_FOLIOS_AROUND,
      { uuid, toh, folioUuid, before, after },
    );

    return response.work?.foliosAround ?? null;
  } catch (error) {
    console.error('Error fetching folios around:', error);
    return null;
  }
}
