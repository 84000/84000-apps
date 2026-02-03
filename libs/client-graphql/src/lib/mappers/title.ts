import type {
  Title,
  Titles,
  TitleType,
  ExtendedTranslationLanguage,
} from '@data-access';

/**
 * GraphQL Title type
 */
export type GraphQLTitle = {
  uuid: string;
  content: string;
  language: string;
  type: string;
};

/**
 * Convert a GraphQL title to the internal Title type
 */
export function titleFromGraphQL(gqlTitle: GraphQLTitle): Title {
  return {
    uuid: gqlTitle.uuid,
    title: gqlTitle.content,
    language: gqlTitle.language as ExtendedTranslationLanguage,
    type: gqlTitle.type as TitleType,
  };
}

/**
 * Convert an array of GraphQL titles to internal Title types
 */
export function titlesFromGraphQL(gqlTitles: GraphQLTitle[]): Titles {
  return gqlTitles.map(titleFromGraphQL);
}
