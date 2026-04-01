import type { DataClient } from '@eightyfourthousand/data-access';

export type DocxImportJobStatus =
  | 'queued_upload'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed';

export interface ImportDiagnostic {
  code: string;
  message: string;
  detail?: string;
}

export interface CreateImportUploadJobInput {
  client: DataClient;
  workUuid: string;
  filename: string;
  contentType: string;
  requestedBy: string;
  dryRun?: boolean;
}

export interface CreateImportUploadJobResult {
  importJobId: string;
  workUuid: string;
  storageBucket: string;
  storagePath: string;
  uploadToken: string;
  signedUrl: string;
  expiresIn: number;
  status: DocxImportJobStatus;
  dryRun: boolean;
}

export interface StartImportJobInput {
  client: DataClient;
  importJobId: string;
}

export interface ImportJobResult {
  importJobId: string;
  workUuid: string;
  status: DocxImportJobStatus;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  dryRun: boolean;
  diagnostics: ImportDiagnostic[];
  warnings: string[];
  result: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}
