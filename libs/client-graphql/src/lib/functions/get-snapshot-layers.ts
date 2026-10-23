import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { SnapshotLayerCatalog } from '../generated/graphql';

export type {
  SnapshotFormatOption,
  SnapshotLayerCatalog,
  SnapshotLayerInfo,
  SnapshotPreset,
} from '../generated/graphql';

const SNAPSHOT_LAYERS = gql`
  query SnapshotLayers {
    snapshotLayers {
      layers {
        name
        description
        permission
        granted
        scope
        sources
        typicalSize
        prebuilt
        tibetanFormats
        options
      }
      presets {
        name
        description
        layers
      }
      formats {
        name
        description
        values
        supported
        default
      }
      maxBundleBytes
    }
  }
`;

export type GetSnapshotLayersResult =
  | { catalog: SnapshotLayerCatalog; error: null }
  | { catalog: null; error: string };

/** A permission failure is passed on as the resolver worded it; anything else is generic. */
const failureMessage = (error: unknown): string => {
  const response = (
    error as { response?: { errors?: { message?: string }[] } } | undefined
  )?.response;
  const message = response?.errors?.[0]?.message?.trim() ?? '';
  return message.startsWith('Permission denied')
    ? message
    : 'The snapshot layer list request failed.';
};

/**
 * Every layer a snapshot bundle can hold, with its options, whether the client
 * may have it, the presets and the bundle-wide formats. Never throws: failures
 * come back as `error`.
 */
export async function getSnapshotLayers({
  client,
  signal,
}: {
  client: GraphQLClient;
  signal?: AbortSignal;
}): Promise<GetSnapshotLayersResult> {
  try {
    const response = await client.request<{
      snapshotLayers: SnapshotLayerCatalog;
    }>({ document: SNAPSHOT_LAYERS, signal });
    return { catalog: response.snapshotLayers, error: null };
  } catch (error) {
    console.error('Error getting snapshot layers:', error);
    return { catalog: null, error: failureMessage(error) };
  }
}
