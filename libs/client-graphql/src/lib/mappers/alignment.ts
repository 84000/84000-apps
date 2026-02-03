import type { Alignment, TohokuCatalogEntry } from '@data-access';

/**
 * GraphQL Alignment type from generated code
 */
export type GraphQLAlignment = {
  folioUuid: string;
  toh: string;
  tibetan: string;
  folioNumber: number;
  volumeNumber: number;
};

/**
 * Convert a GraphQL alignment to the internal Alignment type
 */
export function alignmentFromGraphQL(gqlAlignment: GraphQLAlignment): Alignment {
  return {
    folioUuid: gqlAlignment.folioUuid,
    toh: gqlAlignment.toh as TohokuCatalogEntry,
    tibetan: gqlAlignment.tibetan,
    folioNumber: gqlAlignment.folioNumber,
    volumeNumber: gqlAlignment.volumeNumber,
  };
}

/**
 * Convert an array of GraphQL alignments to internal Alignment types
 */
export function alignmentsFromGraphQL(
  gqlAlignments: GraphQLAlignment[],
): Alignment[] {
  return gqlAlignments.map(alignmentFromGraphQL);
}
