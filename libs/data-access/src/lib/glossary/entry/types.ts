/** Attestations a glossary name may carry. */
export const GLOSSARY_ATTESTATIONS = [
  'attestedApproximate',
  'attestedDictionary',
  'attestedOther',
  'attestedSource',
  'reconstructedPhonetic',
  'reconstructedSemantic',
  'sourceUnspecified',
] as const;

/** How an entry's definition combines with its authority's. */
export const GLOSSARY_DEFINITION_RENDS = [
  'appendWithStandard',
  'incompatibleWithStandard',
  'overrideWithStandard',
  'prependWithStandard',
] as const;

/** How an entry's names are matched in the translation. */
export const GLOSSARY_MODES = ['match', 'marked'] as const;

/** Whether a name is the entry's main translation or an alternative. */
export const GLOSSARY_TERM_TYPES = [
  'translationMain',
  'translationAlternative',
] as const;

/** One name of a glossary entry, as stored. */
export type GlossaryEntryName = {
  glossaryUuid: string;
  nameUuid: string;
  nameAuthorityUuid: string;
  language: string | null;
  content: string;
  /** The Tibetan script, for `Bo-Ltn` names. */
  contentTransformed: string | null;
  termType: string | null;
  attestation: string | null;
};

/** A glossary entry of one work: its root row's values and every name. */
export type GlossaryEntry = {
  uuid: string;
  workUuid: string;
  authorityUuid: string;
  definition: string | null;
  definitionRend: string | null;
  /** `match` when unset. */
  glossMode: string;
  /** The root name first. */
  names: GlossaryEntryName[];
};

/**
 * A name to save. Without `glossaryUuid` it is a new name of the entry;
 * `nameUuid` links an existing names row instead of making one.
 */
export type GlossaryEntryNameInput = {
  glossaryUuid?: string;
  nameUuid?: string;
  language: string;
  content: string;
  contentTransformed: string | null;
  termType: string | null;
  attestation: string | null;
};

/** Only the fields present are written. `names` is the whole list after the save. */
export type GlossaryEntryChange = {
  authorityUuid?: string;
  definition?: string | null;
  definitionRend?: string | null;
  glossMode?: string | null;
  names?: (GlossaryEntryNameInput | GlossaryEntryName)[];
};

/** Stored values a save or delete expects, in the read's representation. */
export type GlossaryEntryExpect = Partial<
  Pick<
    GlossaryEntry,
    'authorityUuid' | 'definition' | 'definitionRend' | 'glossMode' | 'names'
  >
>;

export type GlossaryEntrySave = {
  uuid: string;
  create?: boolean;
  change: GlossaryEntryChange;
  expect?: GlossaryEntryExpect;
};

export type GlossaryEntryDelete = {
  uuid: string;
  expect?: GlossaryEntryExpect;
};

/**
 * An authority a save creates, in the same transaction as the entries that
 * use it. One that already exists is left as it is.
 */
export type GlossaryNewAuthority = {
  uuid: string;
  headword: string;
  headwordLanguage: string;
  definition?: string | null;
};

/** An authority a save creates. `xmlId` is assigned when it is written. */
export type GlossaryCreatedAuthority = {
  uuid: string;
  headword: string;
  headwordLanguage: string;
  definition: string | null;
  /** `null` on a dry run. */
  xmlId: string | null;
};

/**
 * A names row a save does not edit in place: `copied` when another entry,
 * work or creator uses it (the entry gets a copy), `moved` when a relink moves
 * it to the entry's new authority.
 */
export type GlossaryNameRowChange = {
  entryUuid: string;
  nameUuid: string;
  /** The names row's text as stored before the save. */
  language: string | null;
  content: string;
  action: 'copied' | 'moved';
};

export type GlossarySaveChanges = {
  glossaries: { inserted: number; updated: number; deleted: number };
  glossaryEdges: { inserted: number; deleted: number };
  names: { inserted: number; updated: number };
  annotations: { deleted: number };
};

export type GlossarySaveFailure =
  | 'invalid'
  | 'stale'
  | 'not-found'
  | 'exists'
  | 'forbidden'
  | 'failed';

export type GlossarySaveResult =
  | {
      success: true;
      dryRun: boolean;
      /** One per save, in order, as stored after the save. */
      entries: GlossaryEntry[];
      deleted: string[];
      changes: GlossarySaveChanges;
      /** Authorities the save creates; present when there are any. */
      authorities?: GlossaryCreatedAuthority[];
      /** Names rows copied or moved rather than kept or edited; present when there are any. */
      nameRows?: GlossaryNameRowChange[];
    }
  | {
      success: false;
      reason: GlossarySaveFailure;
      error: string;
      /** For `invalid`, the field the database named. */
      field?: string;
      /** The save may have been applied: its response was lost. */
      outcomeUnknown: boolean;
    };

export type GlossaryEntryNameDTO = {
  glossary_uuid: string;
  name_uuid: string;
  name_authority_uuid: string;
  language: string | null;
  content: string;
  content_transformed: string | null;
  term_type: string | null;
  attestation: string | null;
};

export type GlossaryEntryDTO = {
  uuid: string;
  work_uuid: string;
  authority_uuid: string;
  definition: string | null;
  definition_rend: string | null;
  gloss_mode: string;
  names: GlossaryEntryNameDTO[];
};

/** What `apply_glossary_save` returns. */
export type GlossarySaveResultDTO = {
  entries: GlossaryEntryDTO[];
  deleted: string[];
  changes: {
    glossaries: { inserted: number; updated: number; deleted: number };
    glossary_edges: { inserted: number; deleted: number };
    names: { inserted: number; updated: number };
    annotations: { deleted: number };
  };
  /** The authorities the save created, with their assigned `xmlId`. */
  authorities?: { uuid: string; xmlId: string }[];
};

export const glossaryEntryNameFromDTO = (
  dto: GlossaryEntryNameDTO,
): GlossaryEntryName => ({
  glossaryUuid: dto.glossary_uuid,
  nameUuid: dto.name_uuid,
  nameAuthorityUuid: dto.name_authority_uuid,
  language: dto.language,
  content: dto.content,
  contentTransformed: dto.content_transformed,
  termType: dto.term_type,
  attestation: dto.attestation,
});

export const glossaryEntryFromDTO = (dto: GlossaryEntryDTO): GlossaryEntry => ({
  uuid: dto.uuid,
  workUuid: dto.work_uuid,
  authorityUuid: dto.authority_uuid,
  definition: dto.definition,
  definitionRend: dto.definition_rend,
  glossMode: dto.gloss_mode,
  names: (dto.names ?? []).map(glossaryEntryNameFromDTO),
});
