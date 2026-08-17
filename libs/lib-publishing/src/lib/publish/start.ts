/**
 * Starting a publish.
 *
 * Creates or adopts the job, then runs the first tick — which is all most works need, since
 * the median one is ~510 rows.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { startJob } from '../jobs';
import { resolveWork } from '../read-published';
import type { PublishJob, PublishOptions, TickResult } from '../types';
import { DEFAULT_TICK_BUDGET_MS, tickJob } from './tick';

export type StartPublishResult =
  | { ok: true; result: TickResult; adopted: boolean }
  | { ok: false; reason: 'work-not-found' }
  | { ok: false; reason: 'already-running'; job: PublishJob };

/**
 * Starts a publish and runs the first tick.
 *
 * Returns as soon as the budget is spent, so the caller can distinguish "finished" from
 * "in progress" by `result.done` and poll the job if needed.
 *
 * `adopted` means this call took over a job abandoned mid-flight and resumed it from its
 * checkpoint rather than starting fresh — worth surfacing, because the version label and
 * artifact root will be the abandoned attempt's, not new ones.
 */
export const startPublish = async ({
  client,
  options,
  budgetMs = DEFAULT_TICK_BUDGET_MS,
  now,
  newUuid,
}: {
  client: DataClient;
  options: PublishOptions;
  budgetMs?: number;
  now?: () => Date;
  newUuid?: () => string;
}): Promise<StartPublishResult> => {
  const work = await resolveWork({ client, work: options.work });
  if (!work) {
    return { ok: false, reason: 'work-not-found' };
  }

  const started = await startJob({
    client,
    workUuid: work.uuid,
    notes: options.notes,
    requestedBy: options.publishedBy ?? null,
  });

  if (started.outcome === 'busy') {
    return { ok: false, reason: 'already-running', job: started.job };
  }

  const result = await tickJob({
    client,
    jobUuid: started.job.uuid,
    budgetMs,
    now,
    newUuid,
    explicitVersion: options.version,
    publishedBy: options.publishedBy ?? null,
    notes: options.notes ?? null,
    refreshGlossaryIndex: options.refreshGlossaryIndex,
  });

  return { ok: true, result, adopted: started.outcome === 'adopted' };
};
