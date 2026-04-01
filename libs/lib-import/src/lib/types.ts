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

export interface NormalizedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  smallCaps?: boolean;
  href?: string;
}

export interface NormalizedParagraph {
  id: string;
  index: number;
  styleId?: string;
  styleName?: string;
  headingLevel?: number;
  text: string;
  runs: NormalizedRun[];
}

export interface NormalizedDocxDocument {
  paragraphs: NormalizedParagraph[];
  sourcePaths: string[];
}

export interface PreviewAnnotationOperation {
  kind: string;
  start: number;
  end: number;
  data?: Record<string, unknown>;
}

export interface WorkUpdateOperation {
  kind: 'update_work';
  patch: Record<string, unknown>;
}

export interface TitleInsertOperation {
  kind: 'insert_title';
  title: {
    uuid: string;
    workUuid: string;
    content: string;
    language?: string;
    type: string;
  };
}

export interface FolioAnnotationOperation {
  kind: 'upsert_folio_annotation';
  patch: Record<string, unknown>;
}

export interface PassageInsertOperation {
  kind: 'insert_passage';
  passage: {
    uuid: string;
    workUuid: string;
    label: string;
    sort: number;
    type: string;
    content: string;
    xmlId?: string;
  };
  annotations: PreviewAnnotationOperation[];
}

export type ImportOperation =
  | WorkUpdateOperation
  | TitleInsertOperation
  | FolioAnnotationOperation
  | PassageInsertOperation;

export interface ImportPreview {
  document: NormalizedDocxDocument;
  operations: ImportOperation[];
  counts: {
    titles: number;
    passages: number;
    annotations: number;
    workUpdates: number;
    folioUpdates: number;
  };
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
