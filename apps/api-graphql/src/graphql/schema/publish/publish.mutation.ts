/**
 * Publish mutations.
 *
 * Authorization is checked against the requesting user's client; the pipeline then runs on
 * a service_role client, because the artifact bucket has no storage policy and publish_jobs
 * grants writes only to service_role. Permission is never inferred from the pipeline
 * client's power.
 */

import { after } from 'next/server';
import {
  createServiceRoleClient,
  startPublish,
  tickJob,
} from '@eightyfourthousand/lib-publishing/ssr';
import type { GraphQLContext } from '../../context';
import {
  findingToGraphQL,
  isTerminal,
  jobToGraphQL,
  requirePublishPermission,
} from './publish.shared';

export const publishMutations = {
  publishWork: async (
    _parent: unknown,
    args: { work: string; version?: string | null; notes?: string | null },
    ctx: GraphQLContext,
  ) => {
    const session = await requirePublishPermission(ctx);
    const client = createServiceRoleClient();

    const started = await startPublish({
      client,
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
      // A second request for a work already publishing is a normal outcome of a
      // double-clicked button, so return the running job rather than erroring.
      return jobToGraphQL(started.job, isTerminal(started.job));
    }

    const { job, done } = started.result;

    // Keep working after the response is sent, so the client is not held open while a
    // large work finishes. There is deliberately no cron sweep: a scheduler running every
    // minute to serve a tool that publishes rarely is mostly paid idling, and if this
    // continuation is cut short by a function timeout the job stays resumable — the next
    // publish request adopts it from its checkpoint.
    if (!done) {
      after(async () => {
        try {
          let current = job;
          let finished = false;
          while (!finished) {
            const next = await tickJob({ client, jobUuid: current.uuid });
            // No forward progress means another tick holds the lease, or the job is
            // wedged; either way this continuation must stop rather than spin.
            const stalled =
              next.job.phase === current.phase &&
              JSON.stringify(next.job.cursor) === JSON.stringify(current.cursor) &&
              next.job.files.length === current.files.length;
            current = next.job;
            finished = next.done || stalled;
          }
        } catch (error) {
          // The job row carries the failure; this is the last chance to get it into logs.
          console.error(`Publish continuation failed for job ${job.uuid}:`, error);
        }
      });
    }

    return jobToGraphQL(job, done);
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
