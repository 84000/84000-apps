/**
 * Draft work snapshots. Permission is checked with the requesting user's client; the
 * cache itself is service_role only, so the store runs on a service_role client.
 */

import { after } from 'next/server';
import { hasPermission } from '@eightyfourthousand/data-access';
import {
  createServiceRoleClient,
  getWorkSnapshot,
  signSnapshot,
  type GetWorkSnapshotResult,
  type WorkSnapshotRef,
} from '@eightyfourthousand/lib-publishing/ssr';
import { requireAuth, type GraphQLContext } from '../../context';

const READ_PERMISSION = 'editor.read' as const;

interface WorkSnapshotParent {
  ref: WorkSnapshotRef | null;
}

const toGraphQL = (result: GetWorkSnapshotResult) => {
  switch (result.status) {
    case 'ready':
      return {
        status: 'READY',
        ref: result.snapshot,
        snapshotId: result.snapshot.snapshotId,
        workUuid: result.snapshot.workUuid,
        root: result.snapshot.root,
        generatedAt: result.snapshot.generatedAt,
        archiveBytes: result.snapshot.archiveBytes,
        manifest: result.snapshot.manifest,
        ...result.freshness,
      };
    case 'generating':
      return {
        status: 'GENERATING',
        ref: null,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    case 'failed':
      return {
        status: 'FAILED',
        ref: null,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    default:
      return { status: 'NOT_FOUND', ref: null };
  }
};

export const snapshotMutations = {
  ensureWorkSnapshot: async (
    _parent: unknown,
    args: { work: string },
    ctx: GraphQLContext,
  ) => {
    requireAuth(ctx);
    // ctx.supabase carries the caller's token, so PostgREST verifies it here.
    const permitted = await hasPermission({
      client: ctx.supabase,
      permission: READ_PERMISSION,
    });
    if (!permitted) {
      throw new Error(`Permission denied: ${READ_PERMISSION} required`);
    }

    const result = await getWorkSnapshot({
      client: createServiceRoleClient(),
      work: args.work,
      schedule: (task) => after(task),
    });
    return toGraphQL(result);
  },
};

export const workSnapshotResolvers = {
  download: async (parent: WorkSnapshotParent) =>
    parent.ref
      ? signSnapshot({ client: createServiceRoleClient(), ref: parent.ref })
      : null,
};
