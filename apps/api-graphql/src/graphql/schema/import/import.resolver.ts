import {
  createImportUploadJob,
  getImportJob,
  runImportJob,
  startImportJob,
} from '@eightyfourthousand/lib-import';

import { hasPermission } from '@eightyfourthousand/data-access';
import type { GraphQLContext } from '../../context';

async function requireEditorEdit(ctx: GraphQLContext) {
  if (!ctx.session) {
    throw new Error('Authentication required');
  }

  const data = await hasPermission({
    client: ctx.supabase,
    permission: 'editor.edit',
  });

  if (!data) {
    throw new Error('Permission denied: editor.edit required');
  }
}

function toGraphqlStatus(status: string) {
  switch (status) {
    case 'queued_upload':
      return 'QUEUED_UPLOAD';
    case 'queued':
      return 'QUEUED';
    case 'processing':
      return 'PROCESSING';
    case 'needs_review':
      return 'NEEDS_REVIEW';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    default:
      throw new Error(`Unknown import job status: ${status}`);
  }
}

function mapJob(job: Awaited<ReturnType<typeof getImportJob>>) {
  if (!job) {
    return null;
  }

  return {
    ...job,
    status: toGraphqlStatus(job.status),
  };
}

export const importQueries = {
  docxImportJob: async (
    _parent: unknown,
    args: { importJobId: string },
    ctx: GraphQLContext,
  ) => {
    await requireEditorEdit(ctx);
    const job = await getImportJob({
      client: ctx.supabase,
      importJobId: args.importJobId,
    });
    return mapJob(job);
  },
};

export const importMutations = {
  createDocxImportUpload: async (
    _parent: unknown,
    args: {
      workUuid: string;
      filename: string;
      contentType: string;
      dryRun?: boolean;
    },
    ctx: GraphQLContext,
  ) => {
    await requireEditorEdit(ctx);

    const upload = await createImportUploadJob({
      client: ctx.supabase,
      workUuid: args.workUuid,
      filename: args.filename,
      contentType: args.contentType,
      dryRun: args.dryRun ?? false,
      requestedBy: ctx.session!.userId,
    });

    return {
      ...upload,
      status: toGraphqlStatus(upload.status),
    };
  },

  startDocxImport: async (
    _parent: unknown,
    args: { importJobId: string },
    ctx: GraphQLContext,
  ) => {
    await requireEditorEdit(ctx);

    const queuedJob = await startImportJob({
      client: ctx.supabase,
      importJobId: args.importJobId,
    });

    // Transitional best-effort async execution path until a dedicated runner is added.
    void runImportJob({
      client: ctx.supabase,
      importJobId: args.importJobId,
    }).catch((error) => {
      console.error('Failed to execute import job:', error);
    });

    return {
      ...queuedJob,
      status: toGraphqlStatus(queuedJob.status),
    };
  },
};
