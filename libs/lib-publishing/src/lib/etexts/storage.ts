/**
 * eText snapshot objects in the private `etexts-snapshots` bucket. Only service_role
 * reads or writes it; callers authorize users themselves.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type { EtextsSink } from './build';
import {
  ETEXTS_BUCKET,
  ETEXTS_LATEST_PATH,
  type EtextsBuildManifest,
  type EtextsLatest,
} from './layout';

/** Uploads a build's objects. Never overwrites: a build id is used once. */
export const createEtextsStorageSink = (client: DataClient): EtextsSink => ({
  put: async (path, body, contentType) => {
    const { error } = await client.storage
      .from(ETEXTS_BUCKET)
      .upload(path, new Blob([new Uint8Array(body)], { type: contentType }), {
        contentType,
        upsert: false,
      });
    if (error) throw new Error(`Uploading ${path} failed: ${error.message}`);
  },
});

/** Makes `manifest`'s build the one downloads are served from. */
export const publishEtextsBuild = async ({
  client,
  manifest,
}: {
  client: DataClient;
  manifest: EtextsBuildManifest;
}): Promise<void> => {
  const latest: EtextsLatest = {
    formatVersion: manifest.formatVersion,
    buildId: manifest.buildId,
    builtAt: manifest.builtAt,
  };
  const { error } = await client.storage.from(ETEXTS_BUCKET).upload(
    ETEXTS_LATEST_PATH,
    new Blob([JSON.stringify(latest, null, 2) + '\n'], {
      type: 'application/json',
    }),
    { contentType: 'application/json', upsert: true, cacheControl: '0' },
  );
  if (error) {
    throw new Error(`Updating ${ETEXTS_LATEST_PATH} failed: ${error.message}`);
  }
};
