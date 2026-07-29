/**
 * Phase 5 of 6: manifest.
 *
 * The manifest is written after every file it lists, because its presence is what marks an
 * artifact complete: a reader that finds no manifest knows it is looking at an abandoned
 * attempt rather than a usable version.
 */

import { MANIFEST_PATH, METADATA_PATH, artifactRoot } from '../artifact-keys';
import { uploadArtifactFile } from '../artifact-storage';
import { checkpointJob } from '../jobs';
import { resolveWork } from '../read-published';
import { fileEntry, metadataBody, sha256 } from '../serialize';
import {
  ARTIFACT_FORMAT_VERSION,
  type ArtifactManifest,
  type SectionCounts,
} from '../types';
import type { PhaseRunner } from './context';

/**
 * Writes metadata and the manifest, and records the manifest hash.
 *
 * The manifest is written last of all objects because it is the artifact's completeness
 * marker: its presence means every file it lists is already in Storage, so a reader that
 * finds no manifest knows it is looking at an abandoned attempt.
 */
export const runManifestPhase: PhaseRunner = async ({
  client,
  job,
  clock,
}) => {
  const versionUuid = job.versionUuid;
  const version = job.version;
  if (!versionUuid || !version) {
    throw new Error('Manifest phase reached without a version.');
  }

  const work = await resolveWork({ client, work: job.workUuid });
  const root = artifactRoot({ workUuid: job.workUuid, versionUuid });
  const createdAt = clock().toISOString();

  const metaBody = metadataBody({
    versionUuid,
    version,
    workUuid: job.workUuid,
    toh: work?.toh ?? null,
    title: work?.title ?? null,
    createdAt,
  });
  await uploadArtifactFile({ client, root, path: METADATA_PATH, body: metaBody });

  const files = [
    ...job.files,
    fileEntry({ path: METADATA_PATH, body: metaBody, rowCount: 1 }),
  ].sort((a, b) => a.path.localeCompare(b.path));

  const counts = {
    passages: job.counts.passages ?? 0,
    annotations: job.counts.annotations ?? 0,
    glossary: job.counts.glossary ?? 0,
    bibliography: job.counts.bibliography ?? 0,
    alignments: job.counts.alignments ?? 0,
    metadata: 1,
  } satisfies SectionCounts;

  const manifest: ArtifactManifest = {
    formatVersion: ARTIFACT_FORMAT_VERSION,
    workUuid: job.workUuid,
    toh: work?.toh ?? null,
    versionUuid,
    version,
    createdAt,
    files,
    counts,
    warnings: job.warnings,
  };

  const manifestBody = JSON.stringify(manifest, null, 2);
  await uploadArtifactFile({
    client,
    root,
    path: MANIFEST_PATH,
    body: manifestBody,
  });

  const { error } = await client
    .from('work_versions')
    .update({ artifact_manifest_hash: sha256(manifestBody) })
    .eq('uuid', versionUuid);
  if (error) {
    throw new Error(`Failed recording manifest hash: ${JSON.stringify(error)}`);
  }

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: { phase: 'flip', files },
  });
  return { ...job, phase: 'flip', files };
};
