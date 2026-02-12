import type { Imprint, SemVer, TranslationLanguage } from '@data-access';

/**
 * GraphQL TitlesByLanguage type
 */
type GraphQLTitlesByLanguage = {
  tibetan?: string | null;
  english?: string | null;
  wylie?: string | null;
  sanskrit?: string | null;
};

/**
 * GraphQL Imprint type
 */
export type GraphQLImprint = {
  toh: string;
  section?: string | null;
  version?: string | null;
  restriction?: boolean | null;
  publishYear?: string | null;
  tibetanAuthors?: string[] | null;
  isAuthorContested: boolean;
  sourceDescription?: string | null;
  publisherStatement?: string | null;
  tibetanTranslators?: string | null;
  license: {
    name?: string | null;
    link?: string | null;
    description?: string | null;
  } | null;
  mainTitles?: GraphQLTitlesByLanguage | null;
  longTitles?: GraphQLTitlesByLanguage | null;
};

/**
 * Map GraphQL TitlesByLanguage to internal TranslationLanguage keyed record
 */
function titlesFromGraphQL(
  gqlTitles?: GraphQLTitlesByLanguage | null,
): Partial<{ [key in TranslationLanguage]: string }> | undefined {
  if (!gqlTitles) return undefined;

  const result: Partial<{ [key in TranslationLanguage]: string }> = {};
  if (gqlTitles.tibetan) result['bo'] = gqlTitles.tibetan;
  if (gqlTitles.english) result['en'] = gqlTitles.english;
  if (gqlTitles.wylie) result['Bo-Ltn'] = gqlTitles.wylie;
  if (gqlTitles.sanskrit) result['Sa-Ltn'] = gqlTitles.sanskrit;
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Convert a GraphQL Imprint to the internal Imprint type
 */
export function imprintFromGraphQL(
  gqlImprint: GraphQLImprint,
  workUuid: string,
): Imprint {
  return {
    uuid: workUuid,
    toh: gqlImprint.toh,
    section: gqlImprint.section || undefined,
    version: (gqlImprint.version as SemVer) || undefined,
    restriction: gqlImprint.restriction || undefined,
    publishYear: gqlImprint.publishYear || undefined,
    tibetanAuthors: gqlImprint.tibetanAuthors || undefined,
    isAuthorContested: gqlImprint.isAuthorContested,
    sourceDescription: gqlImprint.sourceDescription || undefined,
    publisherStatement: gqlImprint.publisherStatement || undefined,
    tibetanTranslators: gqlImprint.tibetanTranslators || undefined,
    license: {
      link: gqlImprint.license?.link || undefined,
      name: gqlImprint.license?.name || undefined,
      description: gqlImprint.license?.description || undefined,
    },
    mainTitles: titlesFromGraphQL(gqlImprint.mainTitles),
    longTitles: titlesFromGraphQL(gqlImprint.longTitles),
  };
}
