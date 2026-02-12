import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { BibliographyEntryItem } from '@data-access';

const GET_BIBLIOGRAPHY_ENTRY = gql`
  query GetBibliographyEntry($uuid: ID!) {
    bibliographyEntry(uuid: $uuid) {
      uuid
      html
      workUuid
    }
  }
`;

type GetBibliographyEntryResponse = {
  bibliographyEntry: BibliographyEntryItem | null;
};

/**
 * Get a single bibliography entry by UUID.
 */
export async function getBibliographyEntry({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<BibliographyEntryItem | null> {
  try {
    const response = await client.request<GetBibliographyEntryResponse>(
      GET_BIBLIOGRAPHY_ENTRY,
      { uuid },
    );

    return response.bibliographyEntry;
  } catch (error) {
    console.error('Error fetching bibliography entry:', error);
    return null;
  }
}
