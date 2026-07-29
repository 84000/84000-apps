/**
 * Shared helpers for the publish query and mutation resolvers.
 *
 * Authorization is always checked against `ctx.supabase`, which carries the REQUESTING
 * user's identity, so RLS and the `authorize()` RPC evaluate their permissions. The
 * pipeline itself runs on a service_role client (see publish.mutation.ts) because the
 * artifact bucket has no storage policy and `publish_jobs` grants writes only to
 * service_role — but permission must never be inferred from the fact that that client can
 * do anything.
 */

import { hasPermission } from '@eightyfourthousand/data-access';
import type {
  PublishJob,
  ValidationFinding,
} from '@eightyfourthousand/lib-publishing/ssr';
import type { GraphQLContext } from '../../context';

const PUBLISH_PERMISSION = 'editor.admin' as const;

export const requirePublishPermission = async (ctx: GraphQLContext) => {
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

export const findingToGraphQL = (finding: ValidationFinding) => ({
  rule: finding.rule,
  severity: finding.severity,
  message: finding.message,
  // The SQL rule set caps subjects at 20 while reporting the true count, so `count` is
  // authoritative and clients should paginate rather than assume the list is complete.
  subjects: finding.subjects ?? [],
  count: finding.count ?? finding.subjects?.length ?? 0,
});

export const jobToGraphQL = (job: PublishJob, done: boolean) => ({
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

export const isTerminal = (job: PublishJob) =>
  job.status === 'succeeded' || job.status === 'failed';
