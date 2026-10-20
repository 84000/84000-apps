import {
  toEtextsArchiveStatus,
  type EtextsSnapshotSource,
} from '@eightyfourthousand/lib-agent';
import {
  createBearerGraphQLClient,
  getEtextsSnapshot,
} from '@eightyfourthousand/client-graphql/ssr';

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The eText download source for one request. Like the work snapshots, it calls
 * api-graphql with the caller's own `Authorization` header, which authorizes
 * every call there.
 */
export const etextsSnapshotSource = (
  authorization: string,
  signal: AbortSignal,
): EtextsSnapshotSource => {
  const client = createBearerGraphQLClient(authorization);
  return {
    download: async ({ dataset, collection }) =>
      toEtextsArchiveStatus(
        await getEtextsSnapshot({
          client,
          dataset: dataset === 'catalog' ? 'CATALOG' : 'TEXT',
          collection,
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          ]),
        }),
      ),
  };
};
