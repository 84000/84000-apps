import type { Work, TohokuCatalogEntry, SemVer } from '@data-access';

/**
 * GraphQL Work type
 */
export type GraphQLWork = {
  uuid: string;
  title: string;
  toh: string[];
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  section: string;
};

/**
 * Convert a GraphQL work to the internal Work type
 */
export function workFromGraphQL(gqlWork: GraphQLWork): Work {
  return {
    uuid: gqlWork.uuid,
    title: gqlWork.title,
    toh: gqlWork.toh as TohokuCatalogEntry[],
    publicationDate: new Date(gqlWork.publicationDate),
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
