/**
 * Advancing a publish job one tick at a time.
 *
 * A tick claims the job, runs phases until its time budget is spent, then checkpoints and
 * releases. Phase order lives here as a lookup; the phases themselves know nothing about
 * each other.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { claimJob, finishJob, getJob, releaseJob } from '../jobs';
import type { PublishJob, PublishPhase, TickResult } from '../types';
import { runArtifactPhase } from './artifact-phase';
import type { PhaseContext, PhaseRunner } from './context';
import { runFlipPhase } from './flip-phase';
import { runIndexPhase } from './index-phase';
import { runManifestPhase } from './manifest-phase';
import { failPublish } from './recover';
import { runSnapshotPhase } from './snapshot-phase';
import { runValidatePhase } from './validate-phase';

/**
 * How long a tick will keep working before checkpointing and returning.
 *
 * Well inside a conservative serverless ceiling, leaving room for the current phase step
 * to finish after the budget is noticed — the check is between steps, not inside one.
 */
export const DEFAULT_TICK_BUDGET_MS = 20_000;


/**
 * Phase order, as a lookup rather than a switch.
 *
 * `done` deliberately has no runner: reaching it is how a job signals completion, so an
 * absent entry ends the loop instead of needing a special case.
 */
const PHASE_RUNNERS: Partial<Record<PublishPhase, PhaseRunner>> = {
  validate: runValidatePhase,
  snapshot: runSnapshotPhase,
  artifact: runArtifactPhase,
  index: runIndexPhase,
  manifest: runManifestPhase,
  flip: runFlipPhase,
};

const runPhase = async (context: PhaseContext): Promise<PublishJob> => {
  const runner = PHASE_RUNNERS[context.job.phase];
  return runner ? await runner(context) : context.job;
};

/**
 * Advances one job as far as the budget allows.
 *
 * Claiming is what makes this safe to call from several places at once — an after()
 * continuation, a manual advancePublishJob, a CLI run: the loser of the claim gets null and
 * does nothing.
 */
export const tickJob = async ({
  client,
  jobUuid,
  budgetMs = DEFAULT_TICK_BUDGET_MS,
  now,
  newUuid,
  explicitVersion,
  publishedBy,
  notes,
}: {
  client: DataClient;
  jobUuid: string;
  budgetMs?: number;
  now?: () => Date;
  newUuid?: () => string;
  explicitVersion?: string;
  publishedBy?: string | null;
  notes?: string | null;
}): Promise<TickResult> => {
  const clock = now ?? (() => new Date());
  const makeUuid = newUuid ?? (() => crypto.randomUUID());
  const startedAt = clock().getTime();
  const advanced: TickResult['advanced'] = [];

  let job = await claimJob({ client, jobUuid });
  if (!job) {
    const existing = await getJob({ client, jobUuid });
    if (!existing) {
      throw new Error(`Publish job ${jobUuid} not found.`);
    }
    // Another tick holds the lease, or the job already finished. Either way this
    // invocation has nothing to do and must not touch it.
    return {
      job: existing,
      done: existing.status === 'succeeded' || existing.status === 'failed',
      advanced,
    };
  }

  const outOfBudget = () => clock().getTime() - startedAt >= budgetMs;

  try {
    // The budget is checked AFTER each phase, never before the first. A tick that returns
    // without advancing anything is a livelock: the caller ticks again, finds the same
    // state, and nothing ever progresses. Guaranteeing one phase per tick means a budget
    // too small for a phase costs an overrun, which is recoverable, rather than a job that
    // can never finish.
    let steppedOnce = false;

    while (job.status === 'running' && job.phase !== 'done') {
      if (steppedOnce && outOfBudget()) {
        await releaseJob({ client, jobUuid });
        const latest = await getJob({ client, jobUuid });
        return { job: latest ?? job, done: false, advanced };
      }

      const before = job.phase;
      job = await runPhase({
        client,
        job,
        clock,
        makeUuid,
        explicitVersion,
        publishedBy,
        notes,
        outOfBudget,
      });
      steppedOnce = true;
      if (job.phase !== before) {
        advanced.push(before);
      }

      // A phase may have ended the job (validation failure, or a successful flip).
      if (job.status !== 'running') {
        return { job, done: true, advanced };
      }
    }

    if (job.phase === 'done') {
      await finishJob({ client, jobUuid, status: 'succeeded' });
      const finished = await getJob({ client, jobUuid });
      return { job: finished ?? job, done: true, advanced };
    }

    return { job, done: false, advanced };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failPublish({ client, job, message });
    const failed = await getJob({ client, jobUuid });
    return { job: failed ?? job, done: true, advanced };
  } finally {
    const settled = await getJob({ client, jobUuid });
    if (settled && settled.status === 'running') {
      await releaseJob({ client, jobUuid });
    }
  }
};

