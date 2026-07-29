/**
 * Phase 2 of 6: snapshot.
 *
 * One transaction inside Postgres copies the work's draft state into version-scoped
 * published_* rows. Nothing is live yet — only the pointer flip in the final phase makes
 * it so — but from here on the artifact is serialized from these frozen rows rather than
 * from the draft tables, which is what makes the remaining phases safe to spread across
 * several invocations.
 */

import { artifactRoot } from '../artifact-keys';
import { checkpointJob } from '../jobs';
import {
  readVersionLabels,
  resolveWork,
  snapshotWorkVersion,
} from '../read-published';
import { ARTIFACT_BUCKET, type SectionCounts } from '../types';
import { nextVersion } from '../version-label';
import type { PhaseRunner } from './context';

export const runSnapshotPhase: PhaseRunner = async ({
  client,
  job,
  clock,
  makeUuid,
  explicitVersion,
  publishedBy,
  notes,
}) => {
  const work = await resolveWork({ client, work: job.workUuid });
  if (!work) {
    throw new Error(`Work ${job.workUuid} disappeared mid-publish.`);
  }

  const existingVersions = await readVersionLabels({
    client,
    workUuid: job.workUuid,
  });
  const label = nextVersion({
    existingVersions,
    publicationVersion: work.publicationVersion,
    explicit: explicitVersion,
  });
  if (!label.ok) {
    throw new Error(label.error);
  }

  // Minted before the snapshot so the immutable object key is known up front and
  // work_versions.uuid matches it exactly.
  const versionUuid = makeUuid();
  const root = artifactRoot({ workUuid: job.workUuid, versionUuid });

  const { counts } = await snapshotWorkVersion({
    client,
    workUuid: job.workUuid,
    versionUuid,
    version: label.version,
    artifactBucket: ARTIFACT_BUCKET,
    artifactRoot: root,
    publishedBy,
    notes,
  });

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: {
      phase: 'artifact',
      versionUuid,
      version: label.version,
      counts: counts as Partial<SectionCounts>,
      cursor: { section: 'passages', offset: 0, chunk: 1 },
    },
  });

  return {
    ...job,
    phase: 'artifact',
    versionUuid,
    version: label.version,
    counts: counts as Partial<SectionCounts>,
    cursor: { section: 'passages', offset: 0, chunk: 1 },
  };
};
