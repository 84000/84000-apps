import type { DataClient } from '@eightyfourthousand/data-access';

/**
 * Processing state persisted for a DOCX import job.
 */
export type DocxImportJobStatus =
  | 'queued_upload'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed';

/**
 * Importer message that can be surfaced to users or stored with the job.
 */
export interface ImportDiagnostic {
  /** Stable diagnostic identifier for grouping similar importer messages. */
  code: string;
  /** Human-readable diagnostic summary. */
  message: string;
  /** Optional detail about the paragraph, rule, or source value involved. */
  detail?: string;
}

/**
 * Inline text run extracted from a DOCX paragraph with the formatting needed
 * by the import preview and persistence layers.
 */
export interface NormalizedRun {
  /** Plain text content for this run. */
  text: string;
  /** Whether the run uses bold styling. */
  bold?: boolean;
  /** Whether the run uses italic styling. */
  italic?: boolean;
  /** Whether the run uses underline styling. */
  underline?: boolean;
  /** Whether the run uses small caps styling. */
  smallCaps?: boolean;
  /** Hyperlink target associated with the run, when present. */
  href?: string;
}

/**
 * DOCX paragraph normalized into importer-friendly metadata and runs.
 */
export interface NormalizedParagraph {
  /** Stable importer identifier for this paragraph. */
  id: string;
  /** Zero-based paragraph position in the source document. */
  index: number;
  /** DOCX paragraph style identifier, when present. */
  styleId?: string;
  /** Human-readable DOCX paragraph style name, when present. */
  styleName?: string;
  /** Heading level inferred from the paragraph style. */
  headingLevel?: number;
  /** Plain text content across all runs. */
  text: string;
  /** Inline runs that preserve supported formatting and links. */
  runs: NormalizedRun[];
}

/**
 * Minimal normalized representation of a DOCX document used by the importer.
 */
export interface NormalizedDocxDocument {
  /** Paragraphs extracted in source order. */
  paragraphs: NormalizedParagraph[];
  /** DOCX package paths that contributed source content. */
  sourcePaths: string[];
}

/**
 * Annotation operation to create while previewing or persisting imported text.
 */
export interface PreviewAnnotationOperation {
  /** Annotation kind or class produced by mapping rules. */
  kind: string;
  /** Inclusive start offset within the containing passage content. */
  start: number;
  /** Exclusive end offset within the containing passage content. */
  end: number;
  /** Additional annotation-specific attributes. */
  data?: Record<string, unknown>;
}

/**
 * Operation that patches metadata on the target work.
 */
export interface WorkUpdateOperation {
  kind: 'update_work';
  /** Partial database patch derived from imported metadata. */
  patch: Record<string, unknown>;
}

/**
 * Operation that inserts a title for the target work.
 */
export interface TitleInsertOperation {
  kind: 'insert_title';
  /** Title row to insert. */
  title: {
    /** Generated title UUID. */
    uuid: string;
    /** Work that owns the title. */
    workUuid: string;
    /** Title text. */
    content: string;
    /** BCP-style language code for the title, when known. */
    language?: string;
    /** Title classification, such as main title or long title. */
    type: string;
  };
}

/**
 * Operation that creates or updates folio-level annotation metadata.
 */
export interface FolioAnnotationOperation {
  kind: 'upsert_folio_annotation';
  /** Partial database patch for the folio annotation row. */
  patch: Record<string, unknown>;
}

/**
 * Operation that inserts a passage and its child annotations.
 */
export interface PassageInsertOperation {
  kind: 'insert_passage';
  /** Passage row to insert for the target work. */
  passage: {
    /** Generated passage UUID. */
    uuid: string;
    /** Work that owns the passage. */
    workUuid: string;
    /** Human-readable passage label. */
    label: string;
    /** Sort order within the work. */
    sort: number;
    /** Passage body item type. */
    type: string;
    /** Plain text passage content. */
    content: string;
    /** Source XML identifier, when a mapping produced one. */
    xmlId?: string;
  };
  /** Annotation operations scoped to this passage. */
  annotations: PreviewAnnotationOperation[];
}

/**
 * Discriminated union of all importer operations emitted by preview mapping.
 */
export type ImportOperation =
  | WorkUpdateOperation
  | TitleInsertOperation
  | FolioAnnotationOperation
  | PassageInsertOperation;

/**
 * Complete dry-run preview for a DOCX import.
 */
export interface ImportPreview {
  /** Normalized source document used to derive operations. */
  document: NormalizedDocxDocument;
  /** Ordered operations that would be applied for the import. */
  operations: ImportOperation[];
  /** Summary counts for the generated operations. */
  counts: {
    /** Number of title insert operations. */
    titles: number;
    /** Number of passage insert operations. */
    passages: number;
    /** Number of annotation operations across passages. */
    annotations: number;
    /** Number of work metadata updates. */
    workUpdates: number;
    /** Number of folio annotation updates. */
    folioUpdates: number;
  };
}

/**
 * Inputs required to create a storage-backed DOCX import upload job.
 */
export interface CreateImportUploadJobInput {
  /** Supabase client used for database and storage access. */
  client: DataClient;
  /** Work that the uploaded DOCX targets. */
  workUuid: string;
  /** Original filename supplied by the client. */
  filename: string;
  /** MIME type supplied by the client. */
  contentType: string;
  /** User identifier recorded as the requester. */
  requestedBy: string;
  /** When true, process without applying changes. */
  dryRun?: boolean;
}

/**
 * Signed upload details returned after creating an import upload job.
 */
export interface CreateImportUploadJobResult {
  /** Unique identifier for the created import job. */
  importJobId: string;
  /** Work that the uploaded DOCX targets. */
  workUuid: string;
  /** Storage bucket that accepts the upload. */
  storageBucket: string;
  /** Object path where the DOCX should be uploaded. */
  storagePath: string;
  /** Token required by storage to authorize the upload. */
  uploadToken: string;
  /** Signed URL that accepts the upload. */
  signedUrl: string;
  /** Number of seconds before the signed upload URL expires. */
  expiresIn: number;
  /** Initial status for the created job. */
  status: DocxImportJobStatus;
  /** Whether the job is configured as a dry run. */
  dryRun: boolean;
}

/**
 * Inputs required to move an uploaded import job into processing.
 */
export interface StartImportJobInput {
  /** Supabase client used for database and storage access. */
  client: DataClient;
  /** Import job to queue or process. */
  importJobId: string;
}

/**
 * API-facing representation of a DOCX import job and its latest result.
 */
export interface ImportJobResult {
  /** Unique identifier for the import job. */
  importJobId: string;
  /** Work that the import targets. */
  workUuid: string;
  /** Current processing state. */
  status: DocxImportJobStatus;
  /** Storage bucket containing the uploaded DOCX. */
  storageBucket: string;
  /** Object path for the uploaded DOCX. */
  storagePath: string;
  /** Original filename supplied by the client. */
  originalFilename: string;
  /** MIME type supplied for the uploaded file. */
  mimeType: string;
  /** Whether the job previews changes instead of applying them. */
  dryRun: boolean;
  /** Structured diagnostics emitted by the importer. */
  diagnostics: ImportDiagnostic[];
  /** Non-blocking warning messages emitted by the importer. */
  warnings: string[];
  /** Import preview or persistence result payload. */
  result: Record<string, unknown> | null;
  /** ISO timestamp for when the job was created. */
  createdAt?: string;
  /** ISO timestamp for the latest job update. */
  updatedAt?: string;
}
