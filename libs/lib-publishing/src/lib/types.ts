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

/**
 * A work's cached publish readiness, from `work_publish_status`.
 *
 * Advisory: the publish pipeline revalidates, so this says where cleanup is needed, never
 * that a publish will succeed. A work with no cached row has simply never been checked,
 * which is not the same as being publishable.
 */
export interface WorkPublishStatus {
  workUuid: string;
  /** Null when never checked. Callers must not read null as "fine". */
  ok: boolean | null;
  /** Number of error findings, i.e. distinct rules that fired. */
  errorCount: number;
  warningCount: number;
  /** Total error occurrences, which exceed the capped `subjects` arrays. */
  errorOccurrences: number;
  warningOccurrences: number;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  /** When the validation behind this verdict started; null when never checked. */
  checkedAt: string | null;
  /** Last write to any draft table this work's snapshot draws from. */
  draftTouchedAt: string;
  /** The draft changed after the verdict was recorded, so it describes an old state. */
  stale: boolean;
}

/**
 * Whether a draft edit landed strictly after some reference instant.
 *
 * Compares parsed instants rather than the raw strings. Lexicographic comparison happens to
 * work for the UTC ISO form PostgREST returns, but only by accident of that format — it
 * breaks the moment an offset or a differing fractional precision enters.
 *
 * Fails closed: an unparseable timestamp reports "yes, it changed". Both callers would rather
 * over-report a change (a needless re-check, a needless republish) than assure someone that
 * something is current when it cannot be established.
 */
const isTouchedAfter = (
  reference: string | null,
  draftTouchedAt: string | null,
): boolean => {
  if (!reference || !draftTouchedAt) {
    return false;
  }
  const referencePoint = Date.parse(reference);
  const touched = Date.parse(draftTouchedAt);
  if (Number.isNaN(referencePoint) || Number.isNaN(touched)) {
    return true;
  }
  return touched > referencePoint;
};

/**
 * Whether a recorded verdict has been superseded by a later draft edit.
 *
 * Getting this backwards would show a stale verdict as current, which is the one failure the
 * cache must not have.
 */
export const isStale = (
  checkedAt: string | null,
  draftTouchedAt: string | null,
): boolean => isTouchedAfter(checkedAt, draftTouchedAt);

/**
 * Whether the draft has moved on since a version was published.
 *
 * The same comparison as `isStale`, against a different reference: publishing again would
 * produce different content from the version currently live. Deliberately not a content
 * diff — `draft_touched_at` is trigger-maintained on every draft write, so a save that
 * changed nothing still counts. Over-reporting a change is the safe direction; claiming the
 * live version matches a draft that has since moved is not.
 */
export const isDraftChangedSincePublish = (
  publishedAt: string | null,
  draftTouchedAt: string | null,
): boolean => isTouchedAfter(publishedAt, draftTouchedAt);

/** A cached verdict is only usable when the work was checked and has not changed since. */
export const isPublishStatusKnown = (
  status: WorkPublishStatus | undefined,
): boolean => !!status && status.checkedAt !== null && !status.stale;

/**
 * One published version of a work, as version history renders it.
 *
 * Sourced from `work_versions`, which is one row per publish event. Rows are only ever
 * inserted, so this is an append-only record — a failed publish deletes its own row and
 * therefore never appears here.
 */
export interface PublishedVersion {
  uuid: string;
  version: string;
  publishedAt: string;
  /** `auth.users` id. Null for a service-account or pipeline publish. */
  publishedBy: string | null;
  /**
   * The publisher's display name, resolved through `publisher_display_names`.
   *
   * Null when there is no name to show: a service-account publish, a publisher with no
   * profile row, or an account deleted since (the foreign key nulls `publishedBy`). Callers
   * should render an unattributed publish rather than falling back to the raw uuid.
   */
  publisher: string | null;
  notes: string | null;
  /**
   * Matches `works.published_version_uuid` — the version the published_* tables hold.
   *
   * Not "what readers see": the public reader still serves draft content until DEV-558
   * switches it over to the snapshot tables.
   */
  isLive: boolean;
  /**
   * Non-blocking findings recorded by the publish job that produced this version.
   *
   * `null` and `[]` mean different things and must not be collapsed: `[]` is a job that
   * recorded no warnings, while `null` is no job row to read — the audit trail was pruned,
   * or the version predates the job-tracked pipeline. Only the first is "published clean".
   */
  warnings: ValidationFinding[] | null;
}

/**
 * A work's publish history, plus the label a new publish would take.
 *
 * The suggestion is computed with the same `nextVersion` call the snapshot phase makes, over
 * the same label set, so the value offered in the publish dialog is the value the pipeline
 * would pick on its own. `suggestedVersionError` carries the cases it refuses to guess at —
 * chiefly a legacy label that is not SemVer — so a client can ask for an explicit label
 * instead of pre-filling something wrong.
 */
export interface PublishHistory {
  workUuid: string;
  /** Newest first. */
  versions: PublishedVersion[];
  suggestedVersion: string | null;
  suggestedVersionError: string | null;
  /**
   * Last write to any draft table this work's snapshot draws from.
   *
   * Null when the work has never been written to, which is not the same as "unchanged".
   */
  draftTouchedAt: string | null;
  /**
   * Whether the draft has moved on since the live version was published, so publishing again
   * would produce different content.
   *
   * Null when there is nothing to compare against — the work has never been published, or no
   * draft write has ever been recorded. A caller must not render null as "up to date".
   */
  draftChangedSincePublish: boolean | null;
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
