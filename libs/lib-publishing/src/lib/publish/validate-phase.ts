/**
 * Phase 1 of 6: validate.
 *
 * Runs before anything is written, so a hard fail costs nothing to undo — no artifact, no
 * rows, and the previously published version is untouched and still serving.
 */

import { checkpointJob, finishJob } from '../jobs';
import { refreshGlossaryTermIndex, validateWork } from '../read-published';
import type { PhaseRunner } from './context';

/**
 * Validation runs before anything is written, so a hard fail costs nothing to undo.
 *
 * Warnings are carried onto the job and later into the manifest, as the audit trail of
 * what was known at publish time.
 */
export const runValidatePhase: PhaseRunner = async ({
  client,
  job,
  refreshGlossaryIndex,
}) => {
  // Before validating, not after: published_glossaries snapshots the output of a
  // materialized view refreshed hourly by cron, and the artifact is immutable, so a stale
  // read would be baked in permanently.
  //
  // A bulk caller that has already refreshed once opts out, because this is a corpus-wide
  // derivation and repeating it per work dominates the run. Anything else leaves it on.
  if (refreshGlossaryIndex !== false) {
    await refreshGlossaryTermIndex({ client });
  }

  const validation = await validateWork({ client, workUuid: job.workUuid });

  await checkpointJob({
    client,
    jobUuid: job.uuid,
    patch: { warnings: validation.warnings },
  });

  if (!validation.ok) {
    await finishJob({
      client,
      jobUuid: job.uuid,
      status: 'failed',
      error: 'Validation failed. Nothing was written.',
      errors: validation.errors,
    });
    return {
      ...job,
      status: 'failed',
      warnings: validation.warnings,
      errors: validation.errors,
      error: 'Validation failed. Nothing was written.',
    };
  }

  await checkpointJob({ client, jobUuid: job.uuid, patch: { phase: 'snapshot' } });
  return { ...job, phase: 'snapshot', warnings: validation.warnings };
};
