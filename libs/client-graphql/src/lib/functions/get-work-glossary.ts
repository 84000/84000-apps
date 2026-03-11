import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { GlossaryTermInstance } from '@data-access';

const GET_WORK_GLOSSARY = gql`
  query GetWorkGlossary($uuid: ID!, $withAttestations: Boolean) {
    work(uuid: $uuid) {
      glossary(withAttestations: $withAttestations) {
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
  }
`;

type GetWorkGlossaryResponse = {
  work: {
    glossary: GlossaryTermInstance[];
  } | null;
};

/**
 * Get glossary term instances for a specific work.
 */
export async function getWorkGlossary({
  client,
  uuid,
  withAttestations = false,
}: {
  client: GraphQLClient;
  uuid: string;
  withAttestations?: boolean;
}): Promise<GlossaryTermInstance[]> {
  try {
    const response = await client.request<GetWorkGlossaryResponse>(
      GET_WORK_GLOSSARY,
      { uuid, withAttestations },
    );

    return response.work?.glossary ?? [];
  } catch (error) {
    console.error('Error fetching work glossary:', error);
    return [];
  }
}
