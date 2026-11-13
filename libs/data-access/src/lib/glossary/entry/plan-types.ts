import type {
  GlossaryEntry,
  GlossaryEntryName,
  GlossaryEntryNameInput,
  GlossaryNameRowChange,
  GlossarySaveChanges,
  GlossarySaveFailure,
} from './types';

/** A name as a save lists it, or as it is stored. */
export type ElementInput = GlossaryEntryNameInput | GlossaryEntryName;

/** A `names` row as stored. */
export type NameRow = {
  uuid: string;
  authority_uuid: string;
  language: string | null;
  content: string;
  content_transformed: string | null;
  internal: boolean | null;
};

/** A `glossaries` row as stored: the columns a save writes. */
export type GlossaryRow = {
  uuid: string;
  authority_uuid: string;
  name_uuid: string;
  termType: string | null;
  attestation: string | null;
  definition: string | null;
  definition_rend: string | null;
  glossMode: string | null;
};

/** `names` columns a save sets or expects. */
export type NameCols = Partial<
  Pick<
    NameRow,
    'authority_uuid' | 'language' | 'content' | 'content_transformed'
  >
>;

/** `glossaries` columns a save sets or expects. */
export type RowCols = Partial<Omit<GlossaryRow, 'uuid'>>;

/** The arguments of `apply_glossary_save`, but for `p_work_uuid`. */
export type GlossaryPlan = {
  p_entries: { uuid: string; rows: string[] }[];
  p_entry_deletes: { uuid: string; rows: string[]; expected: RowCols }[];
  p_names_insert: Omit<NameRow, never>[];
  p_names_update: { uuid: string; set: NameCols; expected: NameCols }[];
  p_names_link: { uuid: string; expected: NameCols }[];
  p_glossaries_insert: Omit<GlossaryRow, never>[];
  p_glossaries_update: { uuid: string; set: RowCols; expected: RowCols }[];
  p_glossaries_delete: { uuid: string; expected: RowCols }[];
  p_edges_insert: { parent_uuid: string; child_uuid: string }[];
  p_edges_delete: { parent_uuid: string; child_uuid: string }[];
};

/**
 * An `authorities` row a save creates. It is sent apart from the plan, and
 * only when there is one, so a save that creates none calls the database
 * exactly as before.
 */
export type AuthorityInsert = {
  uuid: string;
  headword: string;
  headword_language: string;
  definition: string | null;
};

/** Everything a plan is made from. */
export type StoredState = {
  /** Entries of the work, by uuid, as `read_glossary_entries` reads them. */
  entries: Map<string, GlossaryEntry>;
  /** The saved and deleted entries' rows, by uuid. */
  rows: Map<string, GlossaryRow>;
  /** `glossaries` uuids, of any work, among the uuids the input gives for new rows. */
  takenRows: Set<string>;
  /** Authorities that exist, among the ones the input names or creates. */
  authorities: Set<string>;
  /** `names` rows the plan may link, edit or copy, by uuid. */
  names: Map<string, NameRow>;
  /** `names` rows used by a `creators` row. */
  creatorNames: Set<string>;
  /** `entry uuid > names uuid` for names a `glossaries` row outside the entry uses. */
  usedOutside: Set<string>;
};

/** Why a plan was refused. */
export type PlanFailure = {
  reason: GlossarySaveFailure;
  error: string;
  field?: string;
};

/** A plan and what it reports once applied. */
export type PlannedSave = {
  plan: GlossaryPlan;
  /** The saves' entries as they will be stored, in order. */
  entries: GlossaryEntry[];
  deleted: string[];
  /** Row counts, but for annotations. */
  changes: GlossarySaveChanges;
  /** Authorities to create: the new ones that do not exist yet. */
  authorities: AuthorityInsert[];
  /** Names rows the saves copy or move. */
  nameRows: GlossaryNameRowChange[];
  /** Whether the plan writes anything. */
  writes: boolean;
};
