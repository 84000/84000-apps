import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

const FIND_WORK_PASSAGES = gql`
  query FindWorkPassages($uuid: ID!, $limit: Int, $filter: PassageFilter) {
    work(uuid: $uuid) {
      uuid
      passages(limit: $limit, filter: $filter) {
        nodes {
          uuid
        }
      }
    }
  }
`;

type FindWorkPassagesResponse = {
  work: { uuid: string; passages: { nodes: { uuid: string }[] } } | null;
};

/**
 * Which of `uuids` a work's passages, read through the API, include. With no
 * `uuids`, its first passage. Null when the request fails.
 *
 * The server answers a read it could not make with an empty page, so only a
 * passage found shows that the work can be read.
 */
export async function findWorkPassages({
  client,
  uuid,
  uuids,
}: {
  client: GraphQLClient;
  uuid: string;
  /** At most a page (100). */
  uuids: string[];
}): Promise<Set<string> | null> {
  try {
    const response = await client.request<FindWorkPassagesResponse>(
      FIND_WORK_PASSAGES,
      {
        uuid,
        limit: Math.max(uuids.length, 1),
        filter: uuids.length ? { uuids } : undefined,
      },
    );
    return new Set(
      response.work?.passages.nodes.map((node) => node.uuid) ?? [],
    );
  } catch (error) {
    console.error('Error finding work passages:', error);
    return null;
  }
}
