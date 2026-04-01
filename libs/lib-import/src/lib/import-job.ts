import {
  createSignedUploadUrl,
  DOCX_IMPORT_BUCKET,
  downloadFromStorage,
  type DataClient,
} from '@eightyfourthousand/data-access';
import { v4 as uuidv4 } from 'uuid';

import type {
  CreateImportUploadJobInput,
  CreateImportUploadJobResult,
  ImportDiagnostic,
  ImportJobResult,
  StartImportJobInput,
} from './types';

const SIGNED_UPLOAD_EXPIRY_SECONDS = 60 * 15;

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'upload.docx';
}

async function ensureWorkExists({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}) {
  const { data, error } = await client
    .from('works')
    .select('uuid')
    .eq('uuid', workUuid)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

function mapRowToJobResult(row: Record<string, unknown>): ImportJobResult {
  return {
    importJobId: String(row.uuid),
    workUuid: String(row.work_uuid),
    status: String(row.status) as ImportJobResult['status'],
    storageBucket: String(row.storage_bucket),
    storagePath: String(row.storage_path),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    dryRun: Boolean(row.dry_run),
    diagnostics: Array.isArray(row.diagnostics_json)
      ? (row.diagnostics_json as ImportDiagnostic[])
      : [],
    warnings: Array.isArray(row.warnings_json)
      ? row.warnings_json.map((item) => String(item))
      : [],
    result:
      row.result_json && typeof row.result_json === 'object'
        ? (row.result_json as Record<string, unknown>)
        : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function createImportUploadJob({
  client,
  workUuid,
  filename,
  contentType,
  requestedBy,
  dryRun = false,
}: CreateImportUploadJobInput): Promise<CreateImportUploadJobResult> {
  const workExists = await ensureWorkExists({ client, workUuid });
  if (!workExists) {
    throw new Error(`Work not found: ${workUuid}`);
  }

  const importJobId = uuidv4();
  const safeFilename = sanitizeFilename(filename);
  const storagePath = `${workUuid}/${importJobId}/${safeFilename}`;

  const upload = await createSignedUploadUrl({
    client,
    bucket: DOCX_IMPORT_BUCKET,
    path: storagePath,
  });

  if (!upload) {
    throw new Error('Failed to create signed upload URL');
  }

  const { error } = await client.from('import_jobs').insert({
    uuid: importJobId,
    work_uuid: workUuid,
    storage_bucket: DOCX_IMPORT_BUCKET,
    storage_path: storagePath,
    original_filename: filename,
    mime_type: contentType,
    status: 'queued_upload',
    dry_run: dryRun,
    requested_by: requestedBy,
    diagnostics_json: [],
    warnings_json: [],
    result_json: null,
  });

  if (error) {
    console.error('Failed to create import job:', error);
    throw new Error('Failed to create import job');
  }

  return {
    importJobId,
    workUuid,
    storageBucket: DOCX_IMPORT_BUCKET,
    storagePath,
    uploadToken: upload.token,
    signedUrl: upload.signedUrl,
    expiresIn: SIGNED_UPLOAD_EXPIRY_SECONDS,
    status: 'queued_upload',
    dryRun,
  };
}

export async function getImportJob({
  client,
  importJobId,
}: {
  client: DataClient;
  importJobId: string;
}): Promise<ImportJobResult | null> {
  const { data, error } = await client
    .from('import_jobs')
    .select('*')
    .eq('uuid', importJobId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapRowToJobResult(data);
}

export async function startImportJob({
  client,
  importJobId,
}: StartImportJobInput): Promise<ImportJobResult> {
  const { data, error } = await client
    .from('import_jobs')
    .select('*')
    .eq('uuid', importJobId)
    .single();

  if (error || !data) {
    throw new Error(`Import job not found: ${importJobId}`);
  }

  const file = await downloadFromStorage({
    client,
    bucket: String(data.storage_bucket),
    path: String(data.storage_path),
  });

  if (!file) {
    throw new Error('Uploaded file not found in storage');
  }

  const { error: updateError } = await client
    .from('import_jobs')
    .update({
      status: 'queued',
      diagnostics_json: [],
      warnings_json: [],
      result_json: null,
    })
    .eq('uuid', importJobId);

  if (updateError) {
    console.error('Failed to queue import job:', updateError);
    throw new Error('Failed to queue import job');
  }

  return {
    ...mapRowToJobResult({
      ...data,
      status: 'queued',
      diagnostics_json: [],
      warnings_json: [],
      result_json: null,
    }),
  };
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

  const processingUpdate = await client
    .from('import_jobs')
    .update({ status: 'processing' })
    .eq('uuid', importJobId);

  if (processingUpdate.error) {
    console.error('Failed to mark import job as processing:', processingUpdate.error);
    throw new Error('Failed to mark import job as processing');
  }

  // The deterministic extraction/mapping engine is the next implementation step.
  // For now, queueing and audit records are real, while parsing remains behind this boundary.
  const diagnostics: ImportDiagnostic[] = [
    {
      code: 'IMPORT_PIPELINE_PENDING',
      message: 'Import job was queued successfully, but document parsing has not been implemented yet.',
      detail: 'The GraphQL submission flow, storage handoff, and job tracking are active.',
    },
  ];

  const { data, error } = await client
    .from('import_jobs')
    .update({
      status: 'needs_review',
      diagnostics_json: diagnostics,
      warnings_json: ['Document ingestion pipeline is not implemented yet.'],
      result_json: {
        phase: 'queued',
        parserImplemented: false,
      },
    })
    .eq('uuid', importJobId)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Failed to update import job result:', error);
    throw new Error('Failed to update import job result');
  }

  return mapRowToJobResult(data);
}
