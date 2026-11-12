/**
 * Driving a publish job from start to finish.
 *
 * A serverless caller ticks once and returns, leaving an `after()` continuation to pick the
 * job back up. A command line has no such limit and can run the job straight through, which
 * is what both `publish-work` and the bulk initial publish need.
 *
 * This lives here rather than in either script so the loop — and in particular the stall
 * guard, which is easy to get subtly wrong — has one implementation the two cannot drift
 * apart from.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { getJob } from '../jobs';
import type { PublishJob, PublishOptions } from '../types';
import { startPublish } from './start';
import { tickJob } from './tick';

/**
 * Ticks that may pass without progress before the driver gives up.
 *
 * A tick that cannot claim the job — someone else holds its lease — legitimately returns
 * `done: false` having done nothing, so without this the loop becomes a hot spin. Progress
 * is measured by the phase, cursor, or file count actually moving.
 */
const MAX_STALLED_TICKS = 3;

/** How long to wait out a lease held by a concurrent tick, rather than spinning on it. */
const STALL_WAIT_MS = 2_000;

export type DrivePublishResult =
  /** The job reached `done`. Inspect `job.status`: it may still have finished as `failed`. */
  | { ok: true; job: PublishJob }
  | { ok: false; reason: 'work-not-found' }
  | { ok: false; reason: 'already-running'; job: PublishJob }
  | { ok: false; reason: 'stalled'; job: PublishJob };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts a publish and ticks it until the job is done.
 *
 * `onProgress` fires once per phase the job actually moves into, so a caller can log
 * without the driver assuming anything about how it reports.
 *
 * Resolving with `ok: true` means the job stopped ticking, not that it succeeded — a
 * validation hard fail is a completed job with `status: 'failed'` and findings in
 * `job.errors`. Callers must check `status` before treating a work as published.
 */
export const drivePublish = async ({
  client,
  options,
  onProgress,
  wait = sleep,
}: {
  client: DataClient;
  options: PublishOptions;
  onProgress?: (job: PublishJob) => void;
  /** Injectable so tests do not spend real time waiting out a lease. */
  wait?: (ms: number) => Promise<unknown>;
}): Promise<DrivePublishResult> => {
  const started = await startPublish({ client, options });

  if (!started.ok) {
    return started.reason === 'work-not-found'
      ? { ok: false, reason: 'work-not-found' }
      : { ok: false, reason: 'already-running', job: started.job };
  }

  let { job, done } = started.result;
  let stalled = 0;
  let signature = '';

  while (!done) {
    const next = `${job.phase}:${JSON.stringify(job.cursor)}:${job.files.length}`;

    if (next === signature) {
      stalled += 1;
      if (stalled >= MAX_STALLED_TICKS) {
        return { ok: false, reason: 'stalled', job };
      }
      await wait(STALL_WAIT_MS);
    } else {
      stalled = 0;
      signature = next;
      onProgress?.(job);
    }

    const result = await tickJob({ client, jobUuid: job.uuid });
    job = result.job;
    done = result.done;
  }

  // Re-read rather than trusting the last tick's copy: the flip phase writes the final
  // status, counts, and version onto the row after the tick that advanced into it.
  return { ok: true, job: (await getJob({ client, jobUuid: job.uuid })) ?? job };
};
