import {
  doesWorkExist,
  downloadFromStorage,
  type DataClient,
  type CreateImportUploadJobInput,
  type CreateImportUploadJobResult,
  type ImportDiagnostic,
  type ImportJobResult,
  type StartImportJobInput,
  createImportJob,
  getImportJob,
  updateImportJob,
  assertDocxImportBucketReady,
  pathExistsInStorage,
} from '@eightyfourthousand/data-access';

import { parseDocxDocument } from './docx';
import { persistImportPreview } from './persist';
import { buildImportPreview } from './preview';

function sanitizeFilename(filename: string) {
  return (
    filename
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'upload.docx'
  );
}

async function ensureWorkExists({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}) {
  return doesWorkExist({ client, workUuid });
}

function formatImportDiagnosticMessage({
  code,
  message,
  detail,
}: ImportDiagnostic) {
  return detail ? `${code}: ${message} - ${detail}` : `${code}: ${message}`;
}

async function markImportJobFailed({
  client,
  importJobId,
  diagnostic,
}: {
  client: DataClient;
  importJobId: string;
  diagnostic: ImportDiagnostic;
}) {
  try {
    return await updateImportJob({
      client,
      importJobId,
      status: 'failed',
      diagnostics: [formatImportDiagnosticMessage(diagnostic)],
      warnings: [],
      result: null,
    });
  } catch (updateError) {
    console.error('Failed to mark import job as failed:', updateError);
    return null;
  }
}

export async function createImportUploadJob({
  client,
  workUuid,
  filename,
  contentType,
  requestedBy,
  dryRun = false,
}: CreateImportUploadJobInput): Promise<CreateImportUploadJobResult> {
  await assertDocxImportBucketReady({ client });

  const workExists = await ensureWorkExists({ client, workUuid });
  if (!workExists) {
    throw new Error(`Work not found: ${workUuid}`);
  }

  return await createImportJob({
    client,
    workUuid,
    filename: sanitizeFilename(filename),
    contentType,
    requestedBy,
    dryRun,
  });
}

export async function startImportJob({
  client,
  importJobId,
}: StartImportJobInput): Promise<ImportJobResult> {
  const job = await getImportJob({
    client,
    importJobId,
  });

  if (!job) {
    throw new Error(`Import job not found: ${importJobId}`);
  }

  const { storageBucket, storagePath } = job;
  const exists = await pathExistsInStorage({
    client,
    bucket: storageBucket,
    path: storagePath,
  });

  if (!exists) {
    throw new Error('Uploaded file not found in storage');
  }

  return await updateImportJob({
    client,
    importJobId,
    status: 'queued',
  });
}

export async function runImportJob({
  client,
  importJobId,
}: {
  client: DataClient;
  importJobId: string;
}): Promise<ImportJobResult> {
  const job = await getImportJob({ client, importJobId });
  if (!job) {
    throw new Error(`Import job not found: ${importJobId}`);
  }

  try {
    const { storageBucket, storagePath } = await updateImportJob({
      client,
      importJobId,
      status: 'processing',
    });

    const file = await downloadFromStorage({
      client,
      bucket: storageBucket,
      path: storagePath,
    });

    if (!file) {
      throw new Error('Uploaded file not found in storage');
    }

    const diagnostics: ImportDiagnostic[] = [];
    let warnings: string[] = [];
    let status: ImportJobResult['status'] = 'completed';
    let resultJson: Record<string, unknown> | null = null;

    const document = await parseDocxDocument(file);
    const preview = buildImportPreview({
      document,
      workUuid: job.workUuid,
    });

    if (job.dryRun) {
      resultJson = {
        parsed: true,
        persisted: false,
        preview,
      };
    } else {
      const persistence = await persistImportPreview({
        client,
        workUuid: job.workUuid,
        preview,
      });

      warnings = persistence.warnings;
      resultJson = {
        parsed: true,
        persisted: true,
        preview,
        counts: persistence.counts,
      };
    }

    if (diagnostics.length > 0) {
      status = 'needs_review';
    }

    return await updateImportJob({
      client,
      importJobId,
      status,
      diagnostics: diagnostics.map(formatImportDiagnosticMessage),
      warnings,
      result: resultJson,
    });
  } catch (error) {
    const diagnostic: ImportDiagnostic = {
      code: 'DOCX_IMPORT_FAILED',
      message: 'Failed to process the uploaded .docx document.',
      detail: error instanceof Error ? error.message : String(error),
    };

    const failedJob = await markImportJobFailed({
      client,
      importJobId,
      diagnostic,
    });

    if (failedJob) {
      return failedJob;
    }

    throw error;
  }
}
