import type { Work, TohokuCatalogEntry, SemVer } from '@eightyfourthousand/data-access';

/**
 * GraphQL Work type
 */
export type GraphQLWork = {
  uuid: string;
  title: string;
  toh: string[];
  publicationDate: string | null;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  section: string;
  imprint?: {
    mainTitles?: {
      tibetan?: string | null;
      wylie?: string | null;
      sanskrit?: string | null;
    } | null;
  } | null;
};

/**
 * Convert a GraphQL work to the internal Work type
 */
export function workFromGraphQL(gqlWork: GraphQLWork): Work {
  return {
    uuid: gqlWork.uuid,
    title: gqlWork.title,
    toh: gqlWork.toh as TohokuCatalogEntry[],
    tibetanTitle: gqlWork.imprint?.mainTitles?.tibetan ?? undefined,
    wylieTitle: gqlWork.imprint?.mainTitles?.wylie ?? undefined,
    sanskritTitle: gqlWork.imprint?.mainTitles?.sanskrit ?? undefined,
    publicationDate: gqlWork.publicationDate
      ? new Date(gqlWork.publicationDate)
      : undefined,
    publicationVersion: gqlWork.publicationVersion as SemVer,
    pages: gqlWork.pages,
    restriction: gqlWork.restriction,
    section: gqlWork.section,
  };
}

/**
 * Convert an array of GraphQL works to internal Work types
 */
export function worksFromGraphQL(gqlWorks: GraphQLWork[]): Work[] {
  return gqlWorks.map(workFromGraphQL);
}
