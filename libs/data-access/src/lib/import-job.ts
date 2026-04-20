import { DataClient } from './types';

/**
 * Storage bucket used for DOCX import uploads.
 */
export const DOCX_IMPORT_BUCKET = 'imports';

/**
 * Database status value for a DOCX import job.
 */
export type ImportJobStatus =
  | 'queued_upload'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed';

/**
 * Raw import_jobs row shape returned by Supabase.
 */
export interface ImportJobRecord {
  /** Unique identifier for the import job. */
  uuid: string;
  /** Work targeted by the import. */
  work_uuid: string;
  /** Storage bucket containing the uploaded DOCX. */
  storage_bucket: string;
  /** Object path for the uploaded DOCX. */
  storage_path: string;
  /** Original filename supplied by the client. */
  original_filename: string;
  /** MIME type supplied for the uploaded file. */
  mime_type: string;
  /** Current database status for the job. */
  status: ImportJobStatus;
  /** Whether the job previews changes instead of applying them. */
  dry_run: boolean;
  /** User identifier recorded as the requester. */
  requested_by: string;
  /** Structured diagnostics JSON persisted by the importer. */
  diagnostics_json: unknown[] | null;
  /** Warning messages JSON persisted by the importer. */
  warnings_json: unknown[] | null;
  /** Import preview or persistence result JSON. */
  result_json: Record<string, unknown> | null;
  /** ISO timestamp for when the job was created. */
  created_at?: string;
  /** ISO timestamp for the latest job update. */
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

export const storageBucketExists = async ({
  client,
  bucket,
}: {
  client: DataClient;
  bucket: string;
}) => {
  const { error } = await client.storage.from(bucket).list('', {
    limit: 1,
  });

  if (error) {
    console.error(`Failed to access storage bucket "${bucket}":`, error);
    return false;
  }

  return true;
};
