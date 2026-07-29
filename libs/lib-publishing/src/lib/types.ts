/**
 * Types for the work-level publishing pipeline.
 *
 * Publishing runs inside a Vercel function, so it is a resumable state machine rather
 * than one long call: each tick advances a phase within a time budget and checkpoints to
 * a `publish_jobs` row. The median work (~510 rows) finishes in the first tick; the
 * handful of large works continue across ticks.
 *
 * Row copying and validation happen in Postgres (`snapshot_work_version`,
 * `validate_work_for_publish`) because shipping ~390k rows through a function is what
 * made the previous design impossible to run serverless.
 */

/** Storage bucket holding immutable version artifacts. */
export const ARTIFACT_BUCKET = 'translation-versions';

/** Artifact format version, so readers can detect an older layout. */
export const ARTIFACT_FORMAT_VERSION = 1;

export type ArtifactSection =
  | 'passages'
  | 'annotations'
  | 'glossary'
  | 'bibliography'
  | 'alignments'
  | 'metadata';

export type SectionCounts = Record<ArtifactSection, number>;

/**
 * Phases, in order. The pointer flip in `flip` is the only commit point: everything
 * before it is invisible to readers, so a publish abandoned at any earlier phase leaves
 * the previously published version live and serving.
 */
export const PUBLISH_PHASES = [
  'validate',
  'snapshot',
  'artifact',
  'index',
  'manifest',
  'flip',
  'done',
] as const;

export type PublishPhase = (typeof PUBLISH_PHASES)[number];

export type PublishJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Which artifact section the `artifact` phase is serializing, and how far it got. */
export interface ArtifactCursor {
  section: 'passages' | 'annotations' | 'glossary' | 'bibliography' | 'alignments';
  /** Rows already written for this section. */
  offset: number;
  /** Next chunk number for this section (1-based). */
  chunk: number;
}

/**
 * Sort range covered by one passage chunk.
 *
 * The passage index must name the chunk holding each passage. Recording ranges as chunks
 * are written means the index phase can assign `chunkRef` by range lookup instead of
 * re-reading chunk bodies.
 */
export interface ChunkRange {
  path: string;
  firstSort: number;
  lastSort: number;
  rowCount: number;
}

export interface ArtifactFileEntry {
  path: string;
  sha256: string;
  byteLength: number;
  rowCount: number;
}

export interface PassageIndexEntry {
  sequence: number;
  uuid: string;
  charCount: number;
  chunkRef: string;
  type: string | null;
  sort: number | null;
}

export interface GlossaryIndexEntry {
  glossaryUuid: string;
  termNumber: number | null;
  chunkRef: string;
}

export interface ArtifactManifest {
  formatVersion: number;
  workUuid: string;
  toh: string | null;
  versionUuid: string;
  version: string;
  createdAt: string;
  /** Per-file checksums. The manifest's own sha256 is stored on work_versions. */
  files: ArtifactFileEntry[];
  counts: SectionCounts;
  /** Non-blocking validation findings, recorded for the audit trail. */
  warnings: ValidationFinding[];
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationFinding {
  severity: ValidationSeverity;
  /** Stable machine-readable rule id, e.g. `glossary-instance-unresolved`. */
  rule: string;
  message: string;
  /** Offending entity uuids, capped at 20 by the SQL rule set. */
  subjects?: string[];
  /** Total occurrences, which may exceed `subjects.length`. */
  count?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
}

/** The `publish_jobs` row, as the pipeline sees it. */
export interface PublishJob {
  uuid: string;
  workUuid: string;
  versionUuid: string | null;
  version: string | null;
  status: PublishJobStatus;
  phase: PublishPhase;
  cursor: ArtifactCursor | Record<string, never>;
  chunks: ChunkRange[];
  files: ArtifactFileEntry[];
  counts: Partial<SectionCounts>;
  warnings: ValidationFinding[];
  errors: ValidationFinding[];
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

/**
 * Rows read back out of the version-scoped published_* tables to serialize.
 *
 * These mirror the published table shapes, which is also what the artifact carries, so
 * `rebuild` can insert them straight back.
 */
export interface PublishedPassage {
  uuid: string;
  work_uuid: string;
  content: string | null;
  label: string | null;
  sort: number | null;
  parent: string | null;
  type: string | null;
  toh: string | null;
}

export interface PublishedAnnotation {
  uuid: string;
  passage_uuid: string;
  work_uuid: string;
  type: string;
  start: number;
  end: number;
  content: unknown;
  toh: string | null;
}

export interface PublishedGlossaryTerm {
  glossary_uuid: string;
  authority_uuid: string;
  work_uuid: string;
  headword: string | null;
  headword_language: string | null;
  english: string | null;
  wylie: string | null;
  tibetan: string | null;
  sanskrit_plain: string | null;
  sanskrit_attested: string | null;
  chinese: string | null;
  pali: string | null;
  alternatives: string | null;
  definition: string | null;
  english_sort: string | null;
  headword_sort: string | null;
  term_number: number | null;
  search_text: string | null;
}

export interface PublishedBibliography {
  uuid: string;
  work_uuid: string;
  bibl_html: string | null;
  sort: number | null;
  heading: string | null;
  is_heading: boolean;
  heading_uuid: string | null;
  toh: string | null;
}

export interface AlignmentRow {
  passage_uuid: string;
  folio_uuid: string;
  toh: string | null;
  tibetan: string | null;
  folio_number: number | null;
  volume_number: number | null;
}

export interface PublishOptions {
  /** Tohoku number or work uuid. */
  work: string;
  /** Explicit version label; otherwise patch-bumped from history. */
  version?: string;
  notes?: string;
  publishedBy?: string | null;
}

export interface TickResult {
  job: PublishJob;
  /** False when the job needs another tick. */
  done: boolean;
  /** Phases advanced during this tick, for logging. */
  advanced: PublishPhase[];
}
