/**
 * Publish resolvers.
 *
 * Two clients are in play and the distinction matters. Authorization is checked against
 * `ctx.supabase`, which carries the REQUESTING user's identity, so RLS and the
 * `authorize()` RPC evaluate their permissions. The pipeline then runs on a separate
 * service_role client, because the artifact bucket has no storage policy and publish_jobs
 * grants writes only to service_role. Permission must never be inferred from the fact that
 * the pipeline client can do anything.
 */

import { hasPermission } from '@eightyfourthousand/data-access';
import {
  createServiceRoleClient,
  getJob,
  resolveWork,
  startPublish,
  tickJob,
  validateWork,
  type PublishJob,
  type ValidationFinding,
} from '@eightyfourthousand/lib-publishing/ssr';
import type { GraphQLContext } from '../../context';

const PUBLISH_PERMISSION = 'editor.admin' as const;

const requirePublishPermission = async (ctx: GraphQLContext) => {
  if (!ctx.session) {
    throw new Error('Authentication required');
  }
  const permitted = await hasPermission({
    client: ctx.supabase,
    permission: PUBLISH_PERMISSION,
  });
  if (!permitted) {
    throw new Error(`Permission denied: ${PUBLISH_PERMISSION} required`);
  }
  return ctx.session;
};

const findingToGraphQL = (finding: ValidationFinding) => ({
  rule: finding.rule,
  severity: finding.severity,
  message: finding.message,
  subjects: finding.subjects ?? [],
  count: finding.count ?? finding.subjects?.length ?? 0,
});

const jobToGraphQL = (job: PublishJob, done: boolean) => ({
  uuid: job.uuid,
  workUuid: job.workUuid,
  versionUuid: job.versionUuid,
  version: job.version,
  status: job.status.toUpperCase(),
  phase: job.phase.toUpperCase(),
  done,
  counts: job.counts,
  warnings: job.warnings.map(findingToGraphQL),
  errors: job.errors.map(findingToGraphQL),
  error: job.error,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  finishedAt: job.finishedAt,
});

const isTerminal = (job: PublishJob) =>
  job.status === 'succeeded' || job.status === 'failed';

export const publishQueries = {
  publishJob: async (
    _parent: unknown,
    args: { uuid: string },
    ctx: GraphQLContext,
  ) => {
    await requirePublishPermission(ctx);

    // Read through the user's client so the RLS select policy applies rather than being
    // bypassed: a reader must not be able to poll jobs by guessing uuids.
    const job = await getJob({ client: ctx.supabase, jobUuid: args.uuid });
    return job ? jobToGraphQL(job, isTerminal(job)) : null;
  },

  publishReadiness: async (
    _parent: unknown,
    args: { work: string },
    ctx: GraphQLContext,
  ) => {
    await requirePublishPermission(ctx);

    const work = await resolveWork({ client: ctx.supabase, work: args.work });
    if (!work) {
      return null;
    }

    // validate_work_for_publish is granted to authenticated, so this runs as the user.
    const validation = await validateWork({
      client: ctx.supabase,
      workUuid: work.uuid,
    });

    return {
      ok: validation.ok,
      errors: validation.errors.map(findingToGraphQL),
      warnings: validation.warnings.map(findingToGraphQL),
    };
  },
};

export const publishMutations = {
  publishWork: async (
    _parent: unknown,
    args: { work: string; version?: string | null; notes?: string | null },
    ctx: GraphQLContext,
  ) => {
    const session = await requirePublishPermission(ctx);

    const started = await startPublish({
      client: createServiceRoleClient(),
      options: {
        work: args.work,
        version: args.version ?? undefined,
        notes: args.notes ?? undefined,
        publishedBy: session.userId,
      },
    });

    if (!started.ok) {
      if (started.reason === 'work-not-found') {
        throw new Error(`No work found for "${args.work}".`);
      }
      // A second publish request for the same work is a normal outcome of a
      // double-clicked button, so return the job already running rather than erroring.
      if (started.job) {
        return jobToGraphQL(started.job, isTerminal(started.job));
      }
      throw new Error(`A publish is already running for "${args.work}".`);
    }

    return jobToGraphQL(started.result.job, started.result.done);
  },

  advancePublishJob: async (
    _parent: unknown,
    args: { uuid: string },
    ctx: GraphQLContext,
  ) => {
    await requirePublishPermission(ctx);

    const result = await tickJob({
      client: createServiceRoleClient(),
      jobUuid: args.uuid,
    });
    return jobToGraphQL(result.job, result.done);
  },
};
