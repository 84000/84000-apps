import type { Passage, PassagesPage, BodyItemType } from '@data-access';
import {
  annotationsFromGraphQL,
  type GraphQLAnnotation,
} from './annotation';
import { alignmentsFromGraphQL, type GraphQLAlignment } from './alignment';

/**
 * GraphQL Passage type
 */
export type GraphQLPassage = {
  uuid: string;
  content: string;
  label: string;
  sort: number;
  type: string;
  xmlId?: string | null;
  annotations?: GraphQLAnnotation[];
  alignments?: GraphQLAlignment[];
};

/**
 * GraphQL PassageConnection type
 */
export type GraphQLPassageConnection = {
  nodes: GraphQLPassage[];
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

/**
 * Convert a GraphQL passage to the internal Passage type
 */
export function passageFromGraphQL(
  gqlPassage: GraphQLPassage,
  workUuid: string,
): Passage {
  const annotations = gqlPassage.annotations
    ? annotationsFromGraphQL(gqlPassage.annotations, gqlPassage.uuid)
    : [];

  const alignments = gqlPassage.alignments
    ? alignmentsFromGraphQL(gqlPassage.alignments)
    : [];

  return {
    uuid: gqlPassage.uuid,
    content: gqlPassage.content,
    label: gqlPassage.label,
    sort: gqlPassage.sort,
    type: gqlPassage.type as BodyItemType,
    xmlId: gqlPassage.xmlId ?? undefined,
    workUuid,
    annotations,
    alignments,
  };
}

/**
 * Convert a GraphQL PassageConnection to internal PassagesPage type
 */
export function passagesPageFromGraphQL(
  connection: GraphQLPassageConnection,
  workUuid: string,
): PassagesPage {
  return {
    passages: connection.nodes.map((p) => passageFromGraphQL(p, workUuid)),
    nextCursor: connection.nextCursor ?? undefined,
    prevCursor: connection.prevCursor ?? undefined,
    hasMoreAfter: connection.hasMoreAfter,
    hasMoreBefore: connection.hasMoreBefore,
  };
}
