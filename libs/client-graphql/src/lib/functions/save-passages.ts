import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { Passage } from '@eightyfourthousand/data-access';
import { RequestNotSentError } from '../client';
import type { ReplacedPassage } from './replace';

const SAVE_PASSAGES_MUTATION = gql`
  mutation SavePassages($passages: [PassageInput!]!, $deletedUuids: [ID!]) {
    savePassages(passages: $passages, deletedUuids: $deletedUuids) {
      success
      savedCount
      deletedCount
      error
      passages {
        uuid
        json
      }
      renumberedPassages {
        uuid
        label
      }
      warnings
      outcomeUnknown
    }
  }
`;

/**
 * A passage the server relabelled while renumbering a series. Not part of the
 * submitted payload — the editor uses these to refresh labels it is showing
 * for passages outside its loaded window.
 */
export interface RenumberedPassage {
  uuid: string;
  label: string;
}

interface SavePassagesResponse {
  savePassages: {
    success: boolean;
    savedCount: number;
    deletedCount?: number;
    passages: ReplacedPassage[];
    renumberedPassages: RenumberedPassage[];
    error?: string;
    warnings?: string[] | null;
    outcomeUnknown?: boolean | null;
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
  annotationsIncomplete?: boolean;
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
  annotationsIncomplete: passage.annotationsIncomplete,
});

/**
 * Save one or more passages via GraphQL mutation.
 * Requires editor.edit permission.
 */
export const savePassages = async ({
  client,
  passages,
  deletedUuids,
}: {
  client: GraphQLClient;
  passages: Passage[];
  deletedUuids?: string[];
}): Promise<{
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  passages: ReplacedPassage[];
  renumberedPassages: RenumberedPassage[];
  error?: string;
  /** Problems that did not stop the save. */
  warnings?: string[] | null;
  /**
   * The save failed, but may have been applied: the server lost the
   * database's answer. Re-read the passages before saving them again.
   *
   * Only the server's own report. A request that throws, such as one whose
   * response never arrived, can be just as unknown; the caller judges that.
   */
  outcomeUnknown?: boolean | null;
}> => {
  const variables = {
    passages: passages.map(passageToInput),
    deletedUuids,
  };
  // A body that cannot be serialized is never sent.
  try {
    JSON.stringify(variables);
  } catch (cause) {
    throw new RequestNotSentError(cause);
  }

  const response = await client.request<SavePassagesResponse>(
    SAVE_PASSAGES_MUTATION,
    variables,
  );

  return response.savePassages;
};
