import type { PreviewAnnotationOperation } from '../types';
import type {
  AddAnnotationEdit,
  DeleteTextEdit,
  InsertPassageEdit,
  RemoveAnnotationEdit,
} from '../passage/edits';

/**
 * Stored values an op expects, by field. Each must equal the stored value
 * (deep equality; `null` matches a stored null) or the call is refused
 * before anything is written.
 */
export type ExpectGuard = Record<string, unknown>;

/** Patch the work's `works` row. Several are merged in list order. */
export type UpdateWorkOp = {
  op: 'update-work';
  patch: Record<string, unknown>;
  expect?: ExpectGuard;
};

/**
 * Upsert a title by slot: `(type, language)` when a language is given, else
 * `(type, content)`. A filled slot is updated to `content`; an empty one is
 * inserted. `expect` is checked against the stored row in that slot.
 */
export type UpsertTitleOp = {
  op: 'upsert-title';
  title: { content: string; type: string; language?: string; uuid?: string };
  expect?: ExpectGuard;
};

/**
 * Update the work's `folio_annotations` rows of `annotation_type = 'work'`.
 * Only `source_description` may be patched. `expect` is checked against
 * every one of those rows.
 */
export type UpsertFolioAnnotationOp = {
  op: 'upsert-folio-annotation';
  patch: Record<string, unknown>;
  expect?: ExpectGuard;
};

/**
 * A whole passage and its full annotation set, as an import writes it: uuids
 * derived when omitted, so a re-run updates the rows an earlier run saved.
 */
export type UpsertPassageOp = {
  op: 'upsert-passage';
  passage: {
    label: string;
    type: string;
    content: string;
    sort?: number;
    uuid?: string;
    xmlId?: string;
  };
  annotations?: PreviewAnnotationOperation[];
};

export type WorkMetadataOp =
  | UpdateWorkOp
  | UpsertTitleOp
  | UpsertFolioAnnotationOp;

/** The edits `apply-passage-edits` takes, checked against stored state. */
export type PassageEditOp =
  | DeleteTextEdit
  | AddAnnotationEdit
  | RemoveAnnotationEdit
  | InsertPassageEdit;

export type PassagesOp = UpsertPassageOp | PassageEditOp;

export type WorkEditOp = WorkMetadataOp | PassagesOp;

/**
 * The groups ops fall into, in the order they commit. Each commits through
 * its own write path. Glossary and bibliography groups go after `passages`.
 */
export const WORK_EDIT_GROUPS = ['work-metadata', 'passages'] as const;

export type WorkEditGroup = (typeof WORK_EDIT_GROUPS)[number];

export type WorkEditWarning = { message: string; passageUuid?: string };

export type WorkMetadataChanges = {
  group: 'work-metadata';
  /** The `works` fields the patch sets, with their stored values. */
  work: { fields: Record<string, { from: unknown; to: unknown }> } | null;
  titles: {
    action: 'insert' | 'update';
    uuid: string;
    type: string;
    language: string | null;
    content: string;
    /** The stored content, for an update. */
    previous?: string;
  }[];
  folioAnnotation: { rows: number; fields: Record<string, unknown> } | null;
};

export type PassageChange = {
  uuid: string;
  label: string;
  sort: number;
  action: 'insert' | 'update';
  /** The passage's annotation count after the change. */
  annotations: number;
  /** Edit ops: the passage content after the edit. */
  content?: string;
  /** `upsert-passage` ops. */
  xmlId?: string;
};

export type PassageChanges = {
  group: 'passages';
  passages: PassageChange[];
};

export type WorkEditGroupResult = {
  group: WorkEditGroup;
  /**
   * Whether the group was written. `false` is known to have written nothing.
   * `'unknown'` may have written some or all of it: re-read before retrying.
   * Always `false` on a dry run.
   */
  applied: boolean | 'unknown';
  /** Ops routed to this group. */
  ops: number;
  /** Planned, or written. */
  changes: WorkMetadataChanges | PassageChanges;
  warnings: WorkEditWarning[];
  error?: string;
};

export type ApplyWorkEditsResult = {
  /** Every group planned (dry run) or applied. */
  success: boolean;
  dryRun: boolean;
  /** The groups planned or attempted, in commit order. */
  groups: WorkEditGroupResult[];
  /** Groups with ops that were not written because an earlier step failed. */
  notAttempted: WorkEditGroup[];
  /** The first failure, when `success` is false. */
  error?: string;
};

/** What a group commit reports. */
export type GroupCommit = {
  applied: boolean | 'unknown';
  warnings: WorkEditWarning[];
  error?: string;
};

/**
 * A group planned against stored state: what it would write, and how to
 * write it. Planning reads but never writes.
 */
export type GroupPlan<Changes, Extra = unknown> =
  | {
      ok: true;
      changes: Changes;
      warnings: WorkEditWarning[];
      commit: () => Promise<GroupCommit>;
      /** Detail a caller of the group, such as an alias, may need. */
      extra: Extra;
    }
  | { ok: false; changes: Changes; warnings: WorkEditWarning[]; error: string };
