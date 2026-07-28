/**
 * Types for the work-level publishing pipeline.
 *
 * The version artifact is canonical: `published_*` rows are materialized from it,
 * never directly from draft tables, so the artifact shape below is the contract
 * between publishing (DEV-714) and the reader (DEV-558).
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

/**
 * One passage's entry in `passages/index.json`.
 *
 * `charCount` is what lets the reader reproduce its current pagination (a passage
 * count plus a character budget) from the index alone, and `chunkRef` tells it which
 * chunk objects a page spans so it fetches only those.
 */
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

export interface ArtifactFileEntry {
  path: string;
  sha256: string;
  byteLength: number;
  rowCount: number;
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
  counts: Record<ArtifactSection, number>;
  /** Non-blocking validation findings, recorded for the audit trail. */
  warnings: ValidationFinding[];
}

/** A file to be written to Storage under the artifact root. */
export interface ArtifactFile {
  /** Path relative to the artifact root, e.g. `passages/chunk-0001.json`. */
  path: string;
  body: string;
  rowCount: number;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationFinding {
  severity: ValidationSeverity;
  /** Stable machine-readable rule id, e.g. `glossary-instance-unresolved`. */
  rule: string;
  message: string;
  /** Offending entity uuids, capped when a rule fires in bulk. */
  subjects?: string[];
  /** Total occurrences, which may exceed `subjects.length`. */
  count?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
}

/** Draft state for one work, read once and reused for validation and building. */
export interface DraftWork {
  workUuid: string;
  toh: string | null;
  title: string | null;
  publicationVersion: string | null;
  publishedVersionUuid: string | null;
  passages: DraftPassage[];
  annotations: DraftAnnotation[];
  glossary: DraftGlossaryTerm[];
  bibliographies: DraftBibliography[];
  alignments: DraftAlignment[];
  /** Findings raised while reading, merged into the validation warnings. */
  readWarnings?: ValidationFinding[];
}

export interface DraftPassage {
  uuid: string;
  work_uuid: string;
  content: string | null;
  label: string | null;
  sort: number | null;
  parent: string | null;
  type: string | null;
  toh: string | null;
}

/**
 * Note there is no `work_uuid`: the draft `passage_annotations` table does not carry one
 * (it reaches the work through `passage_uuid`). DEV-557 denormalized `work_uuid` onto
 * `published_passage_annotations`, so the pipeline supplies it at materialize time.
 */
export interface DraftAnnotation {
  uuid: string;
  passage_uuid: string;
  type: string;
  start: number;
  end: number;
  content: unknown;
  toh: string | null;
}

export interface DraftGlossaryTerm {
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

export interface DraftBibliography {
  uuid: string;
  work_uuid: string;
  bibl_html: string | null;
  sort: number | null;
  heading: string | null;
  is_heading: boolean;
  heading_uuid: string | null;
  toh: string | null;
}

export interface DraftAlignment {
  passage_uuid: string;
  folio_uuid: string;
  toh: string | null;
  tibetan: string | null;
  folio_number: string | null;
  volume_number: number | null;
}

export interface PublishOptions {
  /** Tohoku number or work uuid. */
  work: string;
  /** Explicit version label; otherwise patch-bumped from history. */
  version?: string;
  notes?: string;
  publishedBy?: string | null;
  /** Validate and build, but write nothing. */
  dryRun?: boolean;
}

export type PublishStatus =
  | 'published'
  | 'validation-failed'
  | 'dry-run'
  | 'failed';

export interface PublishResult {
  status: PublishStatus;
  workUuid: string | null;
  versionUuid: string | null;
  version: string | null;
  artifactRoot: string | null;
  manifestHash: string | null;
  validation: ValidationResult;
  counts?: Record<ArtifactSection, number>;
  /** Set when status is `failed`. */
  error?: string;
  /** Set when a failed publish could not be cleaned up — needs a human. */
  recoveryError?: string;
}
