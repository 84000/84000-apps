/**
 * Reading and writing version artifacts in Supabase Storage.
 *
 * The bucket is private and carries no `storage.objects` policy at all, so only
 * `service_role` can reach these objects — it bypasses RLS. A client built from a user JWT
 * will fail here, by design.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { MANIFEST_PATH, objectKey } from './artifact-keys';
import { sha256 } from './serialize';
import { ARTIFACT_BUCKET, type ArtifactManifest } from './types';

/**
 * Uploads one artifact file.
 *
 * `upsert: true` is deliberate. A tick that crashes between uploading a chunk and
 * checkpointing its cursor will re-upload the same key on retry; refusing to overwrite
 * would wedge the job on its own partial write. Immutability of published artifacts is
 * guaranteed by the version uuid being unique to this attempt and by the pointer flip
 * being the only thing that makes a version live — not by refusing to overwrite keys
 * belonging to a version that is still in progress.
 */
export const uploadArtifactFile = async ({
  client,
  root,
  path,
  body,
}: {
  client: DataClient;
  root: string;
  path: string;
  body: string;
}): Promise<void> => {
  const key = objectKey({ root, path });

  const { error } = await client.storage
    .from(ARTIFACT_BUCKET)
    .upload(key, new Blob([body], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed uploading ${key}: ${error.message}`);
  }
};

const download = async ({
  client,
  root,
  path,
}: {
  client: DataClient;
  root: string;
  path: string;
}): Promise<string> => {
  const key = objectKey({ root, path });
  const { data, error } = await client.storage.from(ARTIFACT_BUCKET).download(key);

  if (error || !data) {
    throw new Error(
      `Failed downloading ${key}: ${error?.message ?? 'no data returned'}`,
    );
  }

  return await data.text();
};

export const readManifest = async ({
  client,
  root,
}: {
  client: DataClient;
  root: string;
}): Promise<ArtifactManifest> => {
  const body = await download({ client, root, path: MANIFEST_PATH });
  return JSON.parse(body) as ArtifactManifest;
};

/**
 * Downloads one artifact file and verifies it against the manifest checksum.
 *
 * Verifying on read is what keeps the artifact trustworthy as the rebuild source: a
 * rebuild that silently materialized a corrupted chunk would defeat the point of storing
 * per-file hashes.
 */
export const readArtifactFile = async <T>({
  client,
  root,
  path,
  manifest,
}: {
  client: DataClient;
  root: string;
  path: string;
  manifest: ArtifactManifest;
}): Promise<T> => {
  const body = await download({ client, root, path });
  const expected = manifest.files.find((file) => file.path === path);

  if (!expected) {
    throw new Error(`Artifact manifest does not list ${path}`);
  }

  const actual = sha256(body);
  if (actual !== expected.sha256) {
    throw new Error(
      `Checksum mismatch for ${path}: manifest says ${expected.sha256}, got ${actual}`,
    );
  }

  return JSON.parse(body) as T;
};

/** Paths listed in the manifest for a section, in manifest (lexical) order. */
export const sectionPaths = (
  manifest: ArtifactManifest,
  prefix: string,
): string[] =>
  manifest.files
    .filter((file) => file.path.startsWith(`${prefix}/chunk-`))
    .map((file) => file.path);

export const verifyManifestHash = ({
  manifest,
  expectedHash,
}: {
  manifest: ArtifactManifest;
  expectedHash: string | null;
}): boolean => {
  if (!expectedHash) {
    return true;
  }
  return sha256(JSON.stringify(manifest, null, 2)) === expectedHash;
};
