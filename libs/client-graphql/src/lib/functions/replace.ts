import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

export type ReplaceType = 'PASSAGE';

export interface ReplacedPassage {
  json?: TranslationEditorContentItem | null;
  uuid: string;
}

interface ReplaceResponse {
  replace: {
    deletedAnnotationCount: number;
    error?: string;
    nextOccurrenceStart?: number | null;
    nextPassageUuid?: string | null;
    passages: ReplacedPassage[];
    replacedOccurrenceCount: number;
    success: boolean;
    updatedAnnotationCount: number;
    updatedCount: number;
  };
}

const REPLACE_MUTATION = gql`
  mutation Replace(
    $searchText: String!
    $replaceText: String!
    $targetUuids: [ID!]!
    $type: ReplaceType
    $occurrenceIndex: Int
    $cursorPassageUuid: ID
    $cursorStart: Int
  ) {
    replace(
      searchText: $searchText
      replaceText: $replaceText
      targetUuids: $targetUuids
      type: $type
      occurrenceIndex: $occurrenceIndex
      cursorPassageUuid: $cursorPassageUuid
      cursorStart: $cursorStart
    ) {
      success
      updatedCount
      replacedOccurrenceCount
      updatedAnnotationCount
      deletedAnnotationCount
      nextPassageUuid
      nextOccurrenceStart
      error
      passages {
        uuid
        json
      }
    }
  }
`;

export const replace = async ({
  client,
  cursorPassageUuid,
  cursorStart,
  occurrenceIndex,
  replaceText,
  searchText,
  targetUuids,
  type = 'PASSAGE',
}: {
  client: GraphQLClient;
  occurrenceIndex?: number;
  replaceText: string;
  searchText: string;
  cursorPassageUuid?: string;
  cursorStart?: number;
  targetUuids: string[];
  type?: ReplaceType;
}) => {
  const response = await client.request<ReplaceResponse>(REPLACE_MUTATION, {
    searchText,
    replaceText,
    targetUuids,
    type,
    occurrenceIndex,
    cursorPassageUuid,
    cursorStart,
  });

  return response.replace;
};
