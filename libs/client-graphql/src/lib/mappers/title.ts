import {
  TITLE_ATTESTATIONS,
  type Title,
  type TitleAttestation,
  type Titles,
  type TitleType,
  type ExtendedTranslationLanguage,
} from '@eightyfourthousand/data-access';

/**
 * GraphQL Title type
 */
export type GraphQLTitle = {
  uuid: string;
  content: string;
  language: string;
  type: string;
  attestation?: string | null;
};

/**
 * Convert a GraphQL title to the internal Title type
 */
export function titleFromGraphQL(gqlTitle: GraphQLTitle): Title {
  const attestation = (TITLE_ATTESTATIONS as readonly string[]).includes(
    gqlTitle.attestation ?? '',
  )
    ? (gqlTitle.attestation as TitleAttestation)
    : undefined;

  return {
    uuid: gqlTitle.uuid,
    title: gqlTitle.content,
    language: gqlTitle.language as ExtendedTranslationLanguage,
    type: gqlTitle.type as TitleType,
    ...(attestation ? { attestation } : {}),
  };
}

/**
 * Convert an array of GraphQL titles to internal Title types
 */
export function titlesFromGraphQL(gqlTitles: GraphQLTitle[]): Titles {
  return gqlTitles.map(titleFromGraphQL);
}
