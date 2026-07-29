/**
 * Publish queries.
 *
 * Both read through the REQUESTING user's client so RLS and the authorize() RPC apply —
 * a reader must not be able to poll jobs by guessing uuids.
 */

import {
  getJob,
  resolveWork,
  validateWork,
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
