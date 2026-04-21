import { Annotation } from './annotation';
import { DataClient } from './client';
import { BodyItemType, Passage } from './passage';

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
export interface ImportJobDTO {
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
  status: ImportJobStatus;
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
  status: ImportJobStatus;
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

const HEADING_CLASS_FALLBACK = 'section-title';

export const dtoToImportJobResult = (
  row: Record<string, unknown>,
): ImportJobResult => {
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
};

export const previewAnnotationToAnnotation = ({
  annotation,
  passageUuid,
  passageText,
}: {
  annotation: PreviewAnnotationOperation;
  passageUuid: string;
  passageText: string;
}): Annotation | null => {
  const base = {
    uuid: `${passageUuid}:${annotation.kind}:${annotation.start}:${annotation.end}`,
    start: annotation.start,
    end: annotation.end,
    passageUuid,
  };

  if (annotation.kind === 'blockquote') {
    return { ...base, type: 'blockquote' };
  }

  if (annotation.kind === 'paragraph') {
    return { ...base, type: 'paragraph' };
  }

  if (annotation.kind === 'indent') {
    return { ...base, type: 'indent' };
  }

  if (annotation.kind === 'line-group') {
    return { ...base, type: 'lineGroup' };
  }

  if (annotation.kind === 'line') {
    return { ...base, type: 'line' };
  }

  if (annotation.kind === 'span') {
    return {
      ...base,
      type: 'span',
      textStyle:
        typeof annotation.data?.textStyle === 'string'
          ? annotation.data.textStyle
          : undefined,
    };
  }

  if (annotation.kind === 'link') {
    const href =
      typeof annotation.data?.href === 'string'
        ? annotation.data.href
        : undefined;

    if (!href) {
      return null;
    }

    return {
      ...base,
      type: 'link',
      href,
      text: passageText.slice(annotation.start, annotation.end),
    };
  }

  if (annotation.kind === 'heading') {
    const level =
      typeof annotation.data?.level === 'number' ? annotation.data.level : 1;
    const headingClass =
      typeof annotation.data?.class === 'string'
        ? annotation.data.class
        : HEADING_CLASS_FALLBACK;

    return {
      ...base,
      type: 'heading',
      level,
      class: headingClass as never,
    };
  }

  return null;
};

export const normalizePassageType = (type: string): BodyItemType => {
  if (type === 'preface') {
    return 'prelude';
  }

  if (type === 'prefaceHeader') {
    return 'preludeHeader';
  }

  if (type === 'acknowledgement') {
    return 'acknowledgment';
  }

  if (type === 'acknowledgementHeader') {
    return 'acknowledgmentHeader';
  }

  return type as BodyItemType;
};

export const previewDtoToPassage = (
  operation: PassageInsertOperation,
): Passage => {
  return {
    uuid: operation.passage.uuid,
    workUuid: operation.passage.workUuid,
    label: operation.passage.label,
    sort: operation.passage.sort,
    type: normalizePassageType(operation.passage.type),
    content: operation.passage.content,
    xmlId: operation.passage.xmlId,
    annotations: operation.annotations
      .map((annotation) =>
        previewAnnotationToAnnotation({
          annotation,
          passageUuid: operation.passage.uuid,
          passageText: operation.passage.content,
        }),
      )
      .filter((annotation): annotation is Annotation => annotation !== null),
  };
};
