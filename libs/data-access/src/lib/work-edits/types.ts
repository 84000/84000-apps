import type {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_MODES,
  GLOSSARY_TERM_TYPES,
  GlossaryEntry,
  GlossarySaveChanges,
} from '../glossary/entry/types';
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

/**
 * A name of a glossary entry. Without `glossaryUuid` it is matched to the
 * entry's stored names: the first of a list to the root, the rest by
 * language and content, then by language. On a matched name, an omitted
 * optional value keeps the stored one.
 */
export type GlossaryNameInput = {
  glossaryUuid?: string;
  language: string;
  content: string;
  /** The Tibetan script, for `Bo-Ltn` names. */
  contentTransformed?: string | null;
  termType?: (typeof GLOSSARY_TERM_TYPES)[number] | null;
  attestation?: (typeof GLOSSARY_ATTESTATIONS)[number] | null;
};

/** Stored values a glossary op expects. Each key given must equal what is stored. */
export type GlossaryExpect = {
  authority?: string;
  definition?: string | null;
  definitionRend?: (typeof GLOSSARY_DEFINITION_RENDS)[number] | null;
  /** An unset mode reads as `match`. */
  glossMode?: (typeof GLOSSARY_MODES)[number] | null;
  /** Every stored name, in any order, each matched on the fields given. */
  names?: Omit<GlossaryNameInput, 'glossaryUuid'>[];
};

/** An authority an upsert creates with its entry. */
export type GlossaryNewAuthorityInput = {
  headword: string;
  headwordLanguage: string;
  definition?: string | null;
  /** Derived from the entry's uuid when omitted. */
  uuid?: string;
};

/** The entry-wide values an op may set. */
type GlossaryEntryValues = {
  definition?: string | null;
  definitionRend?: (typeof GLOSSARY_DEFINITION_RENDS)[number] | null;
  glossMode?: (typeof GLOSSARY_MODES)[number] | null;
};

/**
 * A whole entry: created when there is none with its uuid, else made to equal
 * the input. The uuid is derived when omitted, so a re-run is safe.
 */
export type UpsertGlossaryEntryOp = {
  op: 'upsert-glossary-entry';
  entry: GlossaryEntryValues & {
    uuid?: string;
    authority: string | { new: GlossaryNewAuthorityInput };
    /** The whole list, the root first. */
    names: GlossaryNameInput[];
  };
  expect?: GlossaryExpect;
};

/** Sets some fields of an entry, each guarded by an `expect` value. */
export type PatchGlossaryEntryOp = {
  op: 'patch-glossary-entry';
  uuid: string;
  set: GlossaryEntryValues & { names?: GlossaryNameInput[] };
  expect: GlossaryExpect;
};

/** Points an entry at another authority; its names move or are copied. */
export type RelinkGlossaryEntryOp = {
  op: 'relink-glossary-entry';
  uuid: string;
  authority: string;
  expect: { authority: string };
};

/** Deletes an entry and this work's glossary instances citing it. */
export type DeleteGlossaryEntryOp = {
  op: 'delete-glossary-entry';
  uuid: string;
  expect?: GlossaryExpect;
};

export type GlossaryOp =
  | UpsertGlossaryEntryOp
  | PatchGlossaryEntryOp
  | RelinkGlossaryEntryOp
  | DeleteGlossaryEntryOp;

export type WorkEditOp = WorkMetadataOp | PassagesOp | GlossaryOp;

/**
 * The groups ops fall into, in the order they commit. Each commits through
 * its own write path. A bibliography group would go after `glossary`.
 */
export const WORK_EDIT_GROUPS = [
  'work-metadata',
  'passages',
  'glossary',
] as const;

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

/** A names row of an entry, as a glossary report names it. */
export type GlossaryNameRowReport = {
  nameUuid: string;
  language: string | null;
  content: string;
};

export type GlossaryEntryReport = {
  uuid: string;
  action: 'create' | 'update' | 'delete' | 'unchanged';
  /** As stored before the op; `null` for a create. */
  before: GlossaryEntry | null;
  /** As it will be stored (dry run) or as stored (applied); `null` for a delete. */
  after: GlossaryEntry | null;
  /** Names rows another entry, work or creator uses, copied rather than moved or edited in place. */
  copiedNames: GlossaryNameRowReport[];
  /** Names rows a relink moves to the new authority. */
  movedNames: GlossaryNameRowReport[];
};

export type GlossaryChanges = {
  group: 'glossary';
  /** One per op, in op order. */
  entries: GlossaryEntryReport[];
  /** Authorities the call creates. `xmlId` is `null` until they are written. */
  authorities: {
    uuid: string;
    headword: string;
    headwordLanguage: string;
    definition: string | null;
    xmlId: string | null;
  }[];
  rows: GlossarySaveChanges;
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
  changes: WorkMetadataChanges | PassageChanges | GlossaryChanges;
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
