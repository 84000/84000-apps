import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { ReplacedPassage } from './replace';

const REMOVE_GLOSSARY_TERM_INSTANCES = gql`
  mutation RemoveGlossaryTermInstances(
    $workUuid: ID!
    $termUuid: ID!
    $annotationUuids: [ID!]!
  ) {
    removeGlossaryTermInstances(
      workUuid: $workUuid
      termUuid: $termUuid
      annotationUuids: $annotationUuids
    ) {
      removed
      failed {
        passageUuid
        passageLabel
        annotationUuids
        error
      }
      passages {
        uuid
        json
      }
      error
    }
  }
`;

/** A passage whose glossary instances could not be removed. */
export type GlossaryInstanceRemovalFailure = {
  /** Empty for instances that were not found. */
  passageUuid: string;
  passageLabel: string | null;
  annotationUuids: string[];
  error: string;
};

/** What a removal did, passage by passage. */
export type RemoveGlossaryTermInstancesResult = {
  /** Instances removed, or already gone. */
  removed: string[];
  failed: GlossaryInstanceRemovalFailure[];
  /** The passages as saved, for the editor to take in. */
  passages: ReplacedPassage[];
  /** Set when nothing was attempted. */
  error?: string | null;
};

type RemoveGlossaryTermInstancesResponse = {
  removeGlossaryTermInstances: RemoveGlossaryTermInstancesResult;
};

/**
 * Removes glossary instances of one term, a passage at a time. A request that
 * fails outright comes back as a result with `error`, nothing removed.
 */
export async function removeGlossaryTermInstances({
  client,
  workUuid,
  termUuid,
  annotationUuids,
}: {
  client: GraphQLClient;
  workUuid: string;
  termUuid: string;
  annotationUuids: string[];
}): Promise<RemoveGlossaryTermInstancesResult> {
  try {
    const response = await client.request<RemoveGlossaryTermInstancesResponse>(
      REMOVE_GLOSSARY_TERM_INSTANCES,
      { workUuid, termUuid, annotationUuids },
    );
    return response.removeGlossaryTermInstances;
  } catch (error) {
    console.error('Error removing glossary term instances:', error);
    return {
      removed: [],
      failed: [],
      passages: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
