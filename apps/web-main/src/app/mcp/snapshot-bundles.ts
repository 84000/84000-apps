import {
  toSnapshotBundleStatus,
  toSnapshotLayerCatalog,
  type SnapshotBundleSource,
} from '@eightyfourthousand/lib-agent';
import {
  createBearerGraphQLClient,
  getSnapshotLayers,
  requestSnapshotBundle,
} from '@eightyfourthousand/client-graphql/ssr';

const LAYERS_TIMEOUT_MS = 30_000;
/** Resolving a work's first draft snapshot can build it inline, so as long as `ensure`. */
const BUNDLE_TIMEOUT_MS = 240_000;

/**
 * The layer bundle source for one request. Like the work snapshots, it calls
 * api-graphql with the caller's own `Authorization` header, which authorizes
 * every call there, each layer's permission included.
 */
export const snapshotBundleSource = (
  authorization: string,
  signal: AbortSignal,
): SnapshotBundleSource => {
  const client = createBearerGraphQLClient(authorization);
  const within = (ms: number) =>
    AbortSignal.any([signal, AbortSignal.timeout(ms)]);
  return {
    bundle: async ({ layers, format }) =>
      toSnapshotBundleStatus(
        await requestSnapshotBundle({
          client,
          layers,
          format,
          signal: within(BUNDLE_TIMEOUT_MS),
        }),
      ),
    layers: async () =>
      toSnapshotLayerCatalog(
        await getSnapshotLayers({ client, signal: within(LAYERS_TIMEOUT_MS) }),
      ),
  };
};
