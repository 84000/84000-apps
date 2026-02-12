import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Passage } from '@data-access';

const SAVE_PASSAGES_MUTATION = gql`
  mutation SavePassages($passages: [PassageInput!]!) {
    savePassages(passages: $passages) {
      success
      savedCount
      error
    }
  }
`;

interface SavePassagesResponse {
  savePassages: {
    success: boolean;
    savedCount: number;
    error?: string;
  };
}

interface PassageInput {
  uuid: string;
  workUuid: string;
  content: string;
  label: string;
  sort: number;
  type: string;
  xmlId?: string;
  annotations: unknown[];
}

/**
 * Convert a Passage to the GraphQL input format
 */
const passageToInput = (passage: Passage): PassageInput => ({
  uuid: passage.uuid,
  workUuid: passage.workUuid,
  content: passage.content,
  label: passage.label,
  sort: passage.sort,
  type: passage.type,
  xmlId: passage.xmlId,
  annotations: passage.annotations,
});

/**
 * Save one or more passages via GraphQL mutation.
 * Requires editor.edit permission.
 */
export const savePassages = async ({
  client,
  passages,
}: {
  client: GraphQLClient;
  passages: Passage[];
}): Promise<{ success: boolean; savedCount: number; error?: string }> => {
  const passageInputs = passages.map(passageToInput);

  const response = await client.request<SavePassagesResponse>(
    SAVE_PASSAGES_MUTATION,
    { passages: passageInputs },
  );

  return response.savePassages;
};
