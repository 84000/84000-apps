/**
 * Phase 6 of 6: flip.
 *
 * The single commit point. Everything before this is invisible to readers, so this update
 * is the moment the new version becomes live — and because it is one statement, there is no
 * window in which a reader sees a partial work.
 */

import { checkpointJob } from '../jobs';
import { deleteVersionRows } from '../materialize';
import { resolveWork } from '../read-published';
import type { PhaseRunner } from './context';

/**
 * Makes the version live, then retires the previous one.
 *
 * The flip is a single update, so there is no window in which a reader sees a partial
 * work. Retiring the old rows happens after and is deliberately non-fatal: the new version
 * is already correct and serving, and leftovers are collectable by `verify --gc`.
 */
export const runFlipPhase: PhaseRunner = async ({
  client,
  job,
}) => {
  const versionUuid = job.versionUuid;
  if (!versionUuid) {
    throw new Error('Flip phase reached without a version uuid.');
  }

  const work = await resolveWork({ client, work: job.workUuid });
  const previousVersionUuid = work?.publishedVersionUuid ?? null;

  const { error } = await client
    .from('works')
    .update({ published_version_uuid: versionUuid })
    .eq('uuid', job.workUuid);
  if (error) {
    throw new Error(`Failed flipping published_version_uuid: ${JSON.stringify(error)}`);
  }

  if (previousVersionUuid && previousVersionUuid !== versionUuid) {
    try {
      await deleteVersionRows({ client, versionUuid: previousVersionUuid });
    } catch (retireError) {
      console.error(
        `Published ${job.version} successfully, but failed to retire the previous ` +
          `version's rows (${previousVersionUuid}). Run verify --gc to clean up.`,
        retireError,
      );
    }
  }

  await checkpointJob({ client, jobUuid: job.uuid, patch: { phase: 'done' } });
  return { ...job, phase: 'done' };
};
