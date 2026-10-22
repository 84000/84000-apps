import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { SnapshotBundle, SnapshotFormatInput } from '../generated/graphql';

export type {
  SnapshotBundle,
  SnapshotBundleLayer,
  SnapshotBundlePart,
  SnapshotFormatInput,
} from '../generated/graphql';

const SNAPSHOT_BUNDLE = gql`
  mutation SnapshotBundle($input: SnapshotBundleInput!) {
    snapshotBundle(input: $input) {
      status
      bundleId
      root
      cached
      createdAt
      estimatedBytes
      maxBytes
      layers {
        layer
        options
        dir
        dataVersion
        prebuilt
        estimatedBytes
        note
      }
      parts {
        url
        expiresAt
        filename
        bytes
        sha256
        into
        layers
      }
      refusedLayers
      error
      retryAfterSeconds
    }
  }
`;

export type RequestSnapshotBundleResult =
  | { bundle: SnapshotBundle; error: null }
  | { bundle: null; error: string };

/** A permission failure is passed on as the resolver worded it; anything else is generic. */
const failureMessage = (error: unknown): string => {
  const response = (
    error as { response?: { errors?: { message?: string }[] } } | undefined
  )?.response;
  const message = response?.errors?.[0]?.message?.trim() ?? '';
  return message.startsWith('Permission denied')
    ? message
    : 'The snapshot bundle request failed.';
};

/**
 * A bundle of snapshot layers, signed for download: one root directory with a
 * README, a manifest and each layer's files. Each layer's permission is checked
 * server-side against the client's credentials. A first build of a work's draft
 * can run inline, so the call can take as long as that build. Never throws:
 * failures come back as `error`.
 */
export async function requestSnapshotBundle({
  client,
  layers,
  format,
  signal,
}: {
  client: GraphQLClient;
  /** Each item is `{ layer: "<name>", ...that layer's options }`. */
  layers: Record<string, unknown>[];
  format?: SnapshotFormatInput;
  signal?: AbortSignal;
}): Promise<RequestSnapshotBundleResult> {
  try {
    const response = await client.request<{ snapshotBundle: SnapshotBundle }>({
      document: SNAPSHOT_BUNDLE,
      variables: { input: { layers, format } },
      signal,
    });
    return { bundle: response.snapshotBundle, error: null };
  } catch (error) {
    console.error('Error requesting snapshot bundle:', error);
    return { bundle: null, error: failureMessage(error) };
  }
}
