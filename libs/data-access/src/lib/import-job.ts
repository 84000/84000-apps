import { DataClient } from './types';

export const DOCX_IMPORT_BUCKET = 'imports';

export type ImportJobStatus =
  | 'queued_upload'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed';

export interface ImportJobRecord {
  uuid: string;
  work_uuid: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  status: ImportJobStatus;
  dry_run: boolean;
  requested_by: string;
  diagnostics_json: unknown[] | null;
  warnings_json: unknown[] | null;
  result_json: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export const createSignedUploadUrl = async ({
  client,
  bucket,
  path,
}: {
  client: DataClient;
  bucket: string;
  path: string;
}) => {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    console.error('Failed to create signed upload URL:', error);
    return null;
  }

  return data;
};

export const downloadFromStorage = async ({
  client,
  bucket,
  path,
}: {
  client: DataClient;
  bucket: string;
  path: string;
}) => {
  const { data, error } = await client.storage.from(bucket).download(path);

  if (error) {
    console.error('Failed to download from storage:', error);
    return null;
  }

  return data;
};
