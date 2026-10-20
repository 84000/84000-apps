/**
 * eText snapshot downloads. The bucket is service_role only, so the published build
 * is read and signed on a service_role client once the caller is authorized.
 */

import {
  createServiceRoleClient,
  readPublishedEtextsBuild,
  signEtextsArchive,
} from '@eightyfourthousand/lib-publishing/ssr';
import type { GraphQLContext } from '../../context';
import { requireSnapshotRead } from './snapshot.mutation';

export const etextsQueries = {
  etextsSnapshot: async (
    _parent: unknown,
    args: { dataset: 'CATALOG' | 'TEXT'; collection?: string | null },
    ctx: GraphQLContext,
  ) => {
    await requireSnapshotRead(ctx);

    const client = createServiceRoleClient();
    const manifest = await readPublishedEtextsBuild(client);
    if (!manifest) {
      return {
        status: 'NOT_FOUND',
        collections: [],
        error: 'No eText build is published yet.',
      };
    }
    const collections = Object.keys(manifest.text);
    const key = args.collection?.trim();
    const archive =
      args.dataset === 'CATALOG'
        ? manifest.catalog
        : key
          ? manifest.text[key]
          : undefined;
    if (!archive) {
      return {
        status: 'NOT_FOUND',
        buildId: manifest.buildId,
        builtAt: manifest.builtAt,
        collections,
        error:
          args.dataset === 'CATALOG'
            ? 'The published eText build has no catalog.'
            : key
              ? `No eText collection "${key}" in the published build.`
              : 'TEXT needs a collection.',
      };
    }

    return {
      status: 'READY',
      buildId: manifest.buildId,
      builtAt: manifest.builtAt,
      collections,
      archiveBytes: archive.bytes,
      unpackedBytes: archive.unpackedBytes,
      files: archive.files,
      sha256: archive.sha256,
      download: await signEtextsArchive({ client, archive }),
    };
  },
};
