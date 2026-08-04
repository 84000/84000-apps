/**
 * Publish queries.
 *
 * Both read through the REQUESTING user's client so RLS and the authorize() RPC apply —
 * a reader must not be able to poll jobs by guessing uuids.
 */

import {
  getJob,
  readFindingLocations,
  readPublishStatus,
  readPublishStatuses,
  resolveWork,
  validateAndRecordWork,
} from '@eightyfourthousand/lib-publishing/ssr';
import type { GraphQLContext } from '../../context';
import {
  findingToGraphQL,
  isTerminal,
  jobToGraphQL,
  requirePublishPermission,
} from './publish.shared';

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

    // validate_and_record_work is granted to authenticated, so this runs as the user. It
    // wraps validate_work_for_publish — the same function the publish mutation calls —
    // and additionally caches the verdict, which is what lets the corpus view read
    // statuses instead of revalidating 456 works.
    const validation = await validateAndRecordWork({
      client: ctx.supabase,
      workUuid: work.uuid,
    });

    return {
      ok: validation.ok,
      errors: validation.errors.map(findingToGraphQL),
      warnings: validation.warnings.map(findingToGraphQL),
    };
  },

  publishStatuses: async (
    _parent: unknown,
    _args: unknown,
    ctx: GraphQLContext,
  ) => {
    await requirePublishPermission(ctx);

    // Read through the user's client so the select policy applies; work_publish_status is
    // granted to authenticated only, not to anon.
    const statuses = await readPublishStatuses({ client: ctx.supabase });

    return statuses.map((status) => ({
      ...status,
      errors: status.errors.map(findingToGraphQL),
      warnings: status.warnings.map(findingToGraphQL),
    }));
  },

  publishStatus: async (
    _parent: unknown,
    args: { work: string },
    ctx: GraphQLContext,
  ) => {
    await requirePublishPermission(ctx);

    const work = await resolveWork({ client: ctx.supabase, work: args.work });
    if (!work) {
      return null;
    }

    // A read, deliberately: unlike publishReadiness this never validates, so opening the
    // publishing tab costs one indexed row lookup.
    const status = await readPublishStatus({
      client: ctx.supabase,
      workUuid: work.uuid,
    });
    if (!status) {
      return null;
    }

    return {
      ...status,
      errors: status.errors.map(findingToGraphQL),
      warnings: status.warnings.map(findingToGraphQL),
    };
  },

  findingLocations: async (
    _parent: unknown,
    args: { work: string; uuids: string[] },
    ctx: GraphQLContext,
  ) => {
    await requirePublishPermission(ctx);

    const work = await resolveWork({ client: ctx.supabase, work: args.work });
    if (!work) {
      return [];
    }

    return readFindingLocations({
      client: ctx.supabase,
      workUuid: work.uuid,
      uuids: args.uuids,
    });
  },
};
