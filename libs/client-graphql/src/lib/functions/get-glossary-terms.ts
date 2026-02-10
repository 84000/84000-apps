import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { GlossaryLandingItem } from '@data-access';

const GET_GLOSSARY_TERMS = gql`
  query GetGlossaryTerms($uuids: [ID!]) {
    glossaryTerms(uuids: $uuids) {
      uuid
      headword
      type
      language
      nameVariants
      definition
      numGlossaryEntries
    }
  }
`;

type GetGlossaryTermsResponse = {
  glossaryTerms: GlossaryLandingItem[];
};

/**
 * Get all glossary terms for the landing page, optionally filtered by UUIDs.
 */
export async function getGlossaryTerms({
  client,
  uuids,
}: {
  client: GraphQLClient;
  uuids?: string[];
}): Promise<GlossaryLandingItem[]> {
  try {
    const response = await client.request<GetGlossaryTermsResponse>(
      GET_GLOSSARY_TERMS,
      { uuids },
    );

    return response.glossaryTerms;
  } catch (error) {
    console.error('Error fetching glossary terms:', error);
    return [];
  }
}
