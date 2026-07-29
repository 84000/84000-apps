/**
 * Cleaning up a publish that failed.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { finishJob } from '../jobs';
import { resolveWork } from '../read-published';
import type { PublishJob } from '../types';

/**
 * Cleans up a publish that failed before the pointer flip.
 *
 * The live version needs no restoration — it was never modified — so this only removes the
 * failed version, whose work_versions row cascades to its snapshot rows. Artifact objects
 * are left in place: keys are version-scoped, so an orphaned artifact is inert, and
 * deleting objects on a failure path risks removing something a retry could reuse.
 */
export const failPublish = async ({
  client,
  job,
  message,
}: {
  client: DataClient;
  job: PublishJob;
  message: string;
}): Promise<void> => {
  let recoveryError: string | undefined;

  if (job.versionUuid) {
    try {
      const work = await resolveWork({ client, work: job.workUuid });
      if (work?.publishedVersionUuid === job.versionUuid) {
        // The flip succeeded but a later step threw. The version is live and correct;
        // deleting its rows would empty a served work.
        recoveryError =
          `Version ${job.versionUuid} is already live despite the failure, so its rows ` +
          `were left in place. Needs manual review.`;
      } else {
        const { error } = await client
          .from('work_versions')
          .delete()
          .eq('uuid', job.versionUuid);
        if (error) {
          recoveryError = `Failed deleting work_versions row ${job.versionUuid}: ${JSON.stringify(error)}`;
        }
      }
    } catch (cleanupError) {
      recoveryError =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
  }

  await finishJob({
    client,
    jobUuid: job.uuid,
    status: 'failed',
    error: recoveryError ? `${message} | CLEANUP FAILED: ${recoveryError}` : message,
  });
};
