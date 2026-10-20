import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { EtextsDataset, EtextsSnapshot } from '../generated/graphql';

export type { EtextsDataset, EtextsSnapshot } from '../generated/graphql';

const ETEXTS_SNAPSHOT = gql`
  query EtextsSnapshot($dataset: EtextsDataset!, $collection: String) {
    etextsSnapshot(dataset: $dataset, collection: $collection) {
      status
      buildId
      builtAt
      collections
      archiveBytes
      unpackedBytes
      files
      sha256
      error
      download {
        url
        expiresAt
        filename
      }
    }
  }
`;

export type GetEtextsSnapshotResult =
  | { snapshot: EtextsSnapshot; error: null }
  | { snapshot: null; error: string };

/** A permission failure is passed on as the resolver worded it; anything else is generic. */
const failureMessage = (error: unknown): string => {
  const response = (
    error as { response?: { errors?: { message?: string }[] } } | undefined
  )?.response;
  const message = response?.errors?.[0]?.message?.trim() ?? '';
  return message.startsWith('Permission denied')
    ? message
    : 'The eText snapshot request failed.';
};

/**
 * A signed download for one archive of the published eText build: the catalog, or
 * one collection's text. Requires `editor.read`, checked server-side against the
 * client's credentials. Never throws: failures come back as `error`.
 */
export async function getEtextsSnapshot({
  client,
  dataset,
  collection,
  signal,
}: {
  client: GraphQLClient;
  dataset: EtextsDataset;
  /** A collection key such as "kangyur/S", for `TEXT`. */
  collection?: string;
  signal?: AbortSignal;
}): Promise<GetEtextsSnapshotResult> {
  try {
    const response = await client.request<{ etextsSnapshot: EtextsSnapshot }>({
      document: ETEXTS_SNAPSHOT,
      variables: { dataset, collection },
      signal,
    });
    return { snapshot: response.etextsSnapshot, error: null };
  } catch (error) {
    console.error('Error getting eText snapshot:', error);
    return { snapshot: null, error: failureMessage(error) };
  }
}
