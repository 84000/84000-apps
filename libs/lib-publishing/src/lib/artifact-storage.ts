/**
 * Reading and writing version artifacts in Supabase Storage.
 *
 * The bucket is private and carries no `storage.objects` policy at all, so only
 * `service_role` can reach these objects — it bypasses RLS. A client built from a user
 * JWT will fail here, by design.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { MANIFEST_PATH, objectKey } from './artifact-keys';
import { sha256 } from './build-artifact';
import {
  ARTIFACT_BUCKET,
  type ArtifactFile,
  type ArtifactManifest,
} from './types';

/** Concurrent uploads. Enough to hide latency without exhausting sockets. */
const UPLOAD_CONCURRENCY = 6;

const upload = async ({
  client,
  root,
  file,
}: {
  client: DataClient;
  root: string;
  file: ArtifactFile;
}): Promise<void> => {
  const key = objectKey({ root, path: file.path });

  // upsert stays false: artifact keys are immutable, so an existing object at this key
  // means the version uuid collided or a previous attempt half-wrote it. Either way
  // that must surface rather than be silently overwritten.
  const { error } = await client.storage
    .from(ARTIFACT_BUCKET)
    .upload(key, new Blob([file.body], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed uploading ${key}: ${error.message}`);
  }
};

/**
 * Writes every artifact file, manifest last.
 *
 * Manifest-last matters for reads: the manifest is the artifact's completeness marker,
 * so its presence means every file it lists was already written. A crash mid-write
 * leaves a manifest-less prefix, which `readManifest` treats as absent.
 */
export const writeArtifact = async ({
  client,
  root,
  files,
}: {
  client: DataClient;
  root: string;
  files: ArtifactFile[];
}): Promise<void> => {
  const payload = files.filter((file) => file.path !== MANIFEST_PATH);
  const manifest = files.find((file) => file.path === MANIFEST_PATH);

  for (let index = 0; index < payload.length; index += UPLOAD_CONCURRENCY) {
    const batch = payload.slice(index, index + UPLOAD_CONCURRENCY);
    await Promise.all(batch.map((file) => upload({ client, root, file })));
  }

  if (manifest) {
    await upload({ client, root, file: manifest });
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
 * Verifying on read is what makes the artifact trustworthy as the canonical source: a
 * rebuild that silently materialized a corrupted chunk would defeat the whole point of
 * storing per-file hashes.
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
