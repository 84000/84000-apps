/**
 * eText snapshot objects in the private `etexts-snapshots` bucket. Only service_role
 * reads or writes it; callers authorize users themselves.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type { EtextsSink } from './build';
import {
  ETEXTS_BUCKET,
  ETEXTS_LATEST_PATH,
  manifestObjectPath,
  type EtextsArchive,
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

/** Lifetime of a signed download URL. Long enough for a slow fetch of the largest archive. */
export const ETEXTS_URL_TTL_SECONDS = 15 * 60;

const readJson = async <T>(
  client: DataClient,
  path: string,
): Promise<T | null> => {
  const { data, error } = await client.storage
    .from(ETEXTS_BUCKET)
    .download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as T;
};

/** The published build's manifest, or null when none is published or it cannot be read. */
export const readPublishedEtextsBuild = async (
  client: DataClient,
): Promise<EtextsBuildManifest | null> => {
  try {
    const latest = await readJson<EtextsLatest>(client, ETEXTS_LATEST_PATH);
    if (!latest?.buildId) return null;
    return await readJson<EtextsBuildManifest>(
      client,
      manifestObjectPath(latest.buildId),
    );
  } catch (error) {
    console.error('Error reading the published eText build:', error);
    return null;
  }
};

/** A short-lived download URL for one of a build's archives. */
export const signEtextsArchive = async ({
  client,
  archive,
  now = Date.now,
}: {
  client: DataClient;
  archive: EtextsArchive;
  now?: () => number;
}): Promise<{ url: string; expiresAt: string; filename: string }> => {
  const issued = now();
  const { data, error } = await client.storage
    .from(ETEXTS_BUCKET)
    .createSignedUrl(archive.path, ETEXTS_URL_TTL_SECONDS, {
      download: archive.filename,
    });
  if (error || !data?.signedUrl) {
    throw new Error(
      `Signing ${archive.path} failed: ${error?.message ?? 'no URL returned'}`,
    );
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(issued + ETEXTS_URL_TTL_SECONDS * 1000).toISOString(),
    filename: archive.filename,
  };
};
