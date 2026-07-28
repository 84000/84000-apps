/**
 * Cron sweep that advances in-progress publish jobs.
 *
 * Most works finish inside the `publishWork` mutation itself. This exists for the handful
 * that cannot — the largest work snapshots ~390k rows — and as the recovery path for any
 * job whose tick was killed mid-flight by a function timeout.
 *
 * It is a route rather than a GraphQL mutation because Vercel Cron can only issue a plain
 * GET to a path. The equivalent user-facing operation is the `advancePublishJob` mutation.
 *
 * Ticks are idempotent: each takes a short lease, so a sweep that overlaps a self-chained
 * request or a previous slow sweep simply loses the claim and does nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  claimableJobs,
  createServiceRoleClient,
  tickJob,
} from '@eightyfourthousand/lib-publishing/ssr';

/**
 * Node runtime, not edge: the pipeline uses node:crypto for artifact checksums and Buffer
 * for byte lengths.
 */
export const runtime = 'nodejs';

/**
 * Long enough to make real progress on a large work, short enough to stay well inside a
 * function ceiling. A job that needs more simply continues on the next sweep.
 */
export const maxDuration = 60;

/** Jobs advanced per sweep. Bounded so one sweep cannot exhaust its own budget queueing. */
const MAX_JOBS_PER_SWEEP = 3;

const TICK_BUDGET_MS = 40_000;

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the variable is set.
 *
 * Without a configured secret the route refuses rather than running openly: publishing is
 * a privileged operation, and an unauthenticated endpoint that advances jobs would let
 * anyone drive them.
 */
const authorized = (req: NextRequest): boolean => {
  const secret = process.env['CRON_SECRET'];
  if (!secret) {
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
};

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized. CRON_SECRET must be configured and presented.' },
      { status: 401 },
    );
  }

  const client = createServiceRoleClient();
  const jobs = await claimableJobs({ client, limit: MAX_JOBS_PER_SWEEP });

  const advanced: {
    uuid: string;
    phase: string;
    status: string;
    done: boolean;
  }[] = [];

  for (const job of jobs) {
    try {
      const result = await tickJob({
        client,
        jobUuid: job.uuid,
        budgetMs: TICK_BUDGET_MS,
      });
      advanced.push({
        uuid: result.job.uuid,
        phase: result.job.phase,
        status: result.job.status,
        done: result.done,
      });
    } catch (error) {
      // One wedged job must not stop the sweep from advancing the others.
      console.error(`Publish tick failed for job ${job.uuid}:`, error);
      advanced.push({
        uuid: job.uuid,
        phase: job.phase,
        status: 'failed',
        done: false,
      });
    }
  }

  return NextResponse.json({ swept: jobs.length, advanced });
}
