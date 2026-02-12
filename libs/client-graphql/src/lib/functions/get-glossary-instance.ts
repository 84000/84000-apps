import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { GlossaryTermInstance } from '@data-access';

const GET_GLOSSARY_INSTANCE = gql`
  query GetGlossaryInstance($uuid: ID!) {
    glossaryInstance(uuid: $uuid) {
      uuid
      authority
      definition
      names {
        english
        tibetan
        sanskrit
        pali
        chinese
        wylie
      }
    }
  }
`;

type GetGlossaryInstanceResponse = {
  glossaryInstance: GlossaryTermInstance | null;
};

/**
 * Get a single glossary instance by UUID.
 */
export async function getGlossaryInstance({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<GlossaryTermInstance | null> {
  try {
    const response = await client.request<GetGlossaryInstanceResponse>(
      GET_GLOSSARY_INSTANCE,
      { uuid },
    );

    return response.glossaryInstance;
  } catch (error) {
    console.error('Error fetching glossary instance:', error);
    return null;
  }
}
