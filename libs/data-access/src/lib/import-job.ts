import { createSignedUploadUrl, SIGNED_UPLOAD_EXPIRY_SECONDS } from './storage';
import { DataClient } from './types';
import {
  CreateImportUploadJobInput,
  CreateImportUploadJobResult,
  DOCX_IMPORT_BUCKET,
  dtoToImportJobResult,
  ImportJobResult,
  ImportJobStatus,
} from './types/import';
import { v4 as uuidv4 } from 'uuid';

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

  return dtoToImportJobResult(data);
}

export const updateImportJob = async ({
  client,
  importJobId,
  status,
  diagnostics = [],
  warnings = [],
  result = null,
}: {
  client: DataClient;
  importJobId: string;
  status: ImportJobStatus;
  diagnostics?: string[];
  warnings?: string[];
  result?: unknown;
}): Promise<ImportJobResult> => {
  const { error, data } = await client
    .from('import_jobs')
    .update({
      status,
      diagnostics_json: diagnostics,
      warnings_json: warnings,
      result_json: result,
    })
    .eq('uuid', importJobId)
    .select('*')
    .single();

  if (error) {
    console.error('Failed to queue import job:', error);
    throw new Error('Failed to queue import job');
  }

  return dtoToImportJobResult(data);
};

export const createImportJob = async ({
  client,
  workUuid,
  filename,
  contentType,
  requestedBy,
  dryRun = false,
}: CreateImportUploadJobInput): Promise<CreateImportUploadJobResult> => {
  const importJobId = uuidv4();
  const storagePath = `${workUuid}/${importJobId}/${filename}`;

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
};

export const assertImportTargetIsEmpty = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}) => {
  const [
    { count: titleCount, error: titleError },
    { count: passageCount, error: passageError },
  ] = await Promise.all([
    client
      .from('titles')
      .select('uuid', { count: 'exact', head: true })
      .eq('work_uuid', workUuid),
    client
      .from('passages')
      .select('uuid', { count: 'exact', head: true })
      .eq('work_uuid', workUuid),
  ]);

  if (titleError) {
    throw titleError;
  }

  if (passageError) {
    throw passageError;
  }

  if ((titleCount || 0) > 0 || (passageCount || 0) > 0) {
    throw new Error(
      `Work ${workUuid} already contains titles or passages. Import currently requires an empty target work.`,
    );
  }
};
