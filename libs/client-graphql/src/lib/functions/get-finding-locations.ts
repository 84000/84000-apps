import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

/**
 * Where a validation finding's subject sits.
 *
 * `kind` is `unknown` when the uuid is not part of this work, which usually means the
 * subject has since been deleted. Those are still shown rather than hidden: a finding
 * pointing at something gone is information, not noise.
 */
export interface FindingLocation {
  uuid: string;
  kind: 'annotation' | 'passage' | 'bibliography' | 'unknown';
  passageUuid: string | null;
  passageLabel: string | null;
  annotationType: string | null;
}

const GET_FINDING_LOCATIONS = gql`
  query FindingLocations($work: String!, $uuids: [ID!]!) {
    findingLocations(work: $work, uuids: $uuids) {
      uuid
      kind
      passageUuid
      passageLabel
      annotationType
    }
  }
`;

interface GetFindingLocationsResponse {
  findingLocations: FindingLocation[];
}

/**
 * Resolve finding subject uuids to the passages they sit in.
 *
 * Returns an empty array on error, so a findings list still renders — just without the
 * links into the text.
 */
export async function getFindingLocations({
  client,
  work,
  uuids,
}: {
  client: GraphQLClient;
  work: string;
  uuids: string[];
}): Promise<FindingLocation[]> {
  if (uuids.length === 0) {
    return [];
  }

  try {
    const response = await client.request<GetFindingLocationsResponse>(
      GET_FINDING_LOCATIONS,
      { work, uuids },
    );
    return response.findingLocations ?? [];
  } catch (error) {
    console.error('Error fetching finding locations:', error);
    return [];
  }
}
