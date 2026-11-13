import { isUuid } from '@eightyfourthousand/lib-utils';
import { v4 as uuidv4 } from 'uuid';

import {
  GLOSSARY_DEFINITION_ALLOWLIST,
  htmlHasText,
  sanitizeHtml,
} from '../../html';
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_MODES,
  GLOSSARY_TERM_TYPES,
  type GlossaryEntry,
  type GlossaryEntryChange,
  type GlossaryEntryDelete,
  type GlossaryEntryExpect,
  type GlossaryEntryName,
  type GlossaryEntryNameInput,
  type GlossaryEntrySave,
  type GlossaryNameRowChange,
  type GlossaryNewAuthority,
  type GlossarySaveChanges,
  type GlossarySaveFailure,
} from './types';

/**
 * Planning a glossary save: from the caller's saves and deletes and the
 * stored state, the explicit row operations `apply_glossary_save` applies.
 * Everything here is pure; `stored.ts` reads what it needs.
 */

type ElementInput = GlossaryEntryNameInput | GlossaryEntryName;

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

type NameCols = Partial<
  Pick<
    NameRow,
    'authority_uuid' | 'language' | 'content' | 'content_transformed'
  >
>;
type RowCols = Partial<Omit<GlossaryRow, 'uuid'>>;

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

export type PlanFailure = {
  reason: GlossarySaveFailure;
  error: string;
  field?: string;
};

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

const ATTESTATIONS = new Set<string>(GLOSSARY_ATTESTATIONS);
const RENDS = new Set<string>(GLOSSARY_DEFINITION_RENDS);
const MODES = new Set<string>(GLOSSARY_MODES);
const TERM_TYPES = new Set<string>(GLOSSARY_TERM_TYPES);

const invalid = (field: string, error: string): PlanFailure => ({
  reason: 'invalid',
  error,
  field,
});

const stale = (error: string): PlanFailure => ({ reason: 'stale', error });

/**
 * A stored value `readStored` guarantees: it refuses reads that disagree, so
 * a missing one is a bug, not a concurrent change.
 */
const must = <K, V>(map: ReadonlyMap<K, V>, key: K): V => {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`The stored state has nothing for ${String(key)}`);
  }
  return value;
};

/** `row`'s values of `keys`. */
const pick = <T extends object, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Pick<T, K> => {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = row[key];
  return out;
};

/**
 * A definition as it is written: reduced to the glossary allowlist, and `null`
 * when no text is left.
 */
export const storedGlossaryDefinition = (
  definition: string | null,
): string | null => {
  if (definition === null) return null;
  const html = sanitizeHtml({
    html: definition,
    allowlist: GLOSSARY_DEFINITION_ALLOWLIST,
    trim: false,
  });
  return htmlHasText(html) ? html : null;
};

/** Whether two matching modes are the same, `null` being `match`. */
const sameMode = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? 'match') === (b ?? 'match');

const sameText = (
  a: Pick<ElementInput, 'language' | 'content' | 'contentTransformed'>,
  b: Pick<GlossaryEntryName, 'language' | 'content' | 'contentTransformed'>,
) =>
  (a.language ?? null) === b.language &&
  a.content === b.content &&
  (a.contentTransformed ?? null) === b.contentTransformed;

/** Whether an optional value equals a stored one, absent being `null`. */
const sameNullable = (a: string | null | undefined, b: string | null) =>
  (a ?? null) === b;

/** Whether `name` would leave the stored `before` as it is. */
const sameName = (name: ElementInput, before: GlossaryEntryName) =>
  (name.nameUuid === undefined || name.nameUuid === before.nameUuid) &&
  sameText(name, before) &&
  sameNullable(name.termType, before.termType) &&
  sameNullable(name.attestation, before.attestation);

/** Whether `names` is the stored list, in any order. */
const sameNames = (
  names: readonly ElementInput[],
  before: readonly GlossaryEntryName[],
) => {
  if (names.length !== before.length) return false;
  const stored = new Map(before.map((name) => [name.glossaryUuid, name]));
  return names.every((name) => {
    const was = name.glossaryUuid ? stored.get(name.glossaryUuid) : undefined;
    // Delete so a row listed twice counts as a change.
    return (
      !!was && stored.delete(name.glossaryUuid as string) && sameName(name, was)
    );
  });
};

type EntryField = keyof Required<GlossaryEntryExpect>;

/** How each entry-wide value compares with the stored entry's. */
const SAME: {
  [K in EntryField]: (
    value: Exclude<GlossaryEntryChange[K], undefined>,
    stored: GlossaryEntry[K],
  ) => boolean;
} = {
  authorityUuid: (a, b) => a === b,
  definition: (a, b) => a === b,
  definitionRend: (a, b) => a === b,
  glossMode: sameMode,
  names: sameNames,
};

/** The entry-wide fields a save changes and an expectation guards. */
export const ENTRY_FIELDS = Object.keys(SAME) as EntryField[];

/** Whether `value` for `key` is absent or the same as `entry`'s. */
export const unchangedField = <K extends EntryField>(
  key: K,
  value: GlossaryEntryChange[K],
  entry: GlossaryEntry,
): boolean =>
  value === undefined ||
  SAME[key](value as Exclude<GlossaryEntryChange[K], undefined>, entry[key]);

// ---------------------------------------------------------------- input checks

/** Checks a written name's fixed values; `null` when they are fine. */
const checkWrittenName = (
  name: ElementInput,
  at: string,
  {
    text,
    termType,
    attestation,
  }: Record<'text' | 'termType' | 'attestation', boolean>,
): PlanFailure | null => {
  if (text) {
    if (!name.language)
      return invalid(`${at}.language`, 'A name needs a language');
    if (!name.content) return invalid(`${at}.content`, 'A name needs its text');
    if (name.language === 'Bo-Ltn' && !name.contentTransformed) {
      return invalid(
        `${at}.contentTransformed`,
        'A Tibetan name needs its Tibetan script',
      );
    }
  }
  if (termType && name.termType != null && !TERM_TYPES.has(name.termType)) {
    return invalid(`${at}.termType`, `Unknown term type ${name.termType}`);
  }
  if (
    attestation &&
    name.attestation != null &&
    !ATTESTATIONS.has(name.attestation)
  ) {
    return invalid(
      `${at}.attestation`,
      `Unknown attestation ${name.attestation}`,
    );
  }
  return null;
};

const checkRend = (value: string | null | undefined) =>
  value == null || RENDS.has(value)
    ? null
    : invalid('definitionRend', `Unknown definition rend ${value}`);

const checkMode = (value: string | null | undefined) =>
  value == null || MODES.has(value)
    ? null
    : invalid('glossMode', `Unknown matching mode ${value}`);

/**
 * Refuses input that is invalid whatever is stored: malformed or repeated
 * uuids, a create's values (a create writes all of them) and a new name's.
 */
export const checkInput = (
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
  authorities: readonly GlossaryNewAuthority[] = [],
): PlanFailure | null => {
  const created = new Set<string>();
  for (const [i, authority] of authorities.entries()) {
    const at = `authorities[${i}]`;
    if (!isUuid(authority.uuid)) {
      return invalid(`${at}.uuid`, `${authority.uuid} is not a uuid`);
    }
    if (created.has(authority.uuid)) {
      return invalid(
        `${at}.uuid`,
        `Authority ${authority.uuid} is created twice`,
      );
    }
    created.add(authority.uuid);
    if (!authority.headword?.trim()) {
      return invalid(`${at}.headword`, 'A new authority needs a headword');
    }
    if (!authority.headwordLanguage?.trim()) {
      return invalid(
        `${at}.headwordLanguage`,
        'A new authority needs the language of its headword',
      );
    }
  }

  const entries = new Set<string>();
  for (const { uuid } of [...saves, ...deletes]) {
    if (!isUuid(uuid)) return invalid('uuid', `${uuid} is not a uuid`);
    if (entries.has(uuid)) {
      return invalid('uuid', `Entry ${uuid} is saved or deleted twice`);
    }
    entries.add(uuid);
  }

  const rows = new Map<string, string>();
  for (const save of saves) {
    const names = save.change.names ?? [];
    for (const [i, name] of names.entries()) {
      const at = `names[${i}]`;
      for (const key of ['glossaryUuid', 'nameUuid'] as const) {
        const value = name[key];
        if (value !== undefined && !isUuid(value)) {
          return invalid(`${at}.${key}`, `${value} is not a uuid`);
        }
      }
      const row = save.create && i === 0 ? save.uuid : name.glossaryUuid;
      if (!row) continue;
      const owner = rows.get(row);
      if (
        (owner !== undefined && owner !== save.uuid) ||
        (entries.has(row) && row !== save.uuid)
      ) {
        return invalid(`${at}.glossaryUuid`, `Row ${row} is in two entries`);
      }
      if (owner === save.uuid && !(save.create && i === 0)) {
        return invalid(`${at}.glossaryUuid`, `Row ${row} is listed twice`);
      }
      rows.set(row, save.uuid);
    }

    const writtenNames = (written: (name: ElementInput) => boolean) =>
      names.reduce<PlanFailure | null>(
        (found, name, i) =>
          found ??
          (written(name)
            ? checkWrittenName(name, `names[${i}]`, {
                text: !name.nameUuid,
                termType: true,
                attestation: true,
              })
            : null),
        null,
      );

    if (!save.create) {
      const { authorityUuid } = save.change;
      if (authorityUuid !== undefined && !isUuid(authorityUuid)) {
        return invalid('authorityUuid', `${authorityUuid} is not a uuid`);
      }
      // A name without a row is new, so all its values are written.
      const fault = writtenNames((name) => !name.glossaryUuid);
      if (fault) return fault;
      continue;
    }
    if (save.expect !== undefined) {
      return invalid('expect', 'A create has nothing to expect');
    }
    const { authorityUuid, definitionRend, glossMode } = save.change;
    if (!authorityUuid || !isUuid(authorityUuid)) {
      return invalid('authorityUuid', 'A new entry needs an authority');
    }
    if (!names.length) {
      return invalid('names', 'A new entry needs at least one name');
    }
    if (
      names[0].glossaryUuid !== undefined &&
      names[0].glossaryUuid !== save.uuid
    ) {
      return invalid(
        'names[0].glossaryUuid',
        "The first name's row is the entry",
      );
    }
    const fault =
      checkRend(definitionRend) ??
      checkMode(glossMode) ??
      writtenNames(() => true);
    if (fault) return fault;
  }
  return null;
};

/** The uuids `stored.ts` needs to read for these saves and deletes. */
export const plannedReads = (
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
  authorities: readonly GlossaryNewAuthority[] = [],
) => ({
  entries: [
    ...saves.filter((s) => !s.create).map((s) => s.uuid),
    ...deletes.map((d) => d.uuid),
  ],
  creates: saves.filter((s) => s.create).map((s) => s.uuid),
  authorities: [
    ...new Set([
      ...saves.flatMap((s) =>
        s.change.authorityUuid ? [s.change.authorityUuid] : [],
      ),
      ...authorities.map((a) => a.uuid),
    ]),
  ],
  links: [
    ...new Set(
      saves.flatMap((s) =>
        (s.change.names ?? []).flatMap((n) => (n.nameUuid ? [n.nameUuid] : [])),
      ),
    ),
  ],
});

// ---------------------------------------------------------------- the plan

type NamePlan = {
  nameUuid: string;
  authorityUuid: string;
  text: Pick<GlossaryEntryName, 'language' | 'content' | 'contentTransformed'>;
};

const nameText = (name: ElementInput | NameRow) =>
  'glossaryUuid' in name || !('uuid' in name)
    ? {
        language: (name as ElementInput).language ?? null,
        content: (name as ElementInput).content,
        contentTransformed: (name as ElementInput).contentTransformed ?? null,
      }
    : {
        language: (name as NameRow).language,
        content: (name as NameRow).content,
        contentTransformed: (name as NameRow).content_transformed,
      };

const textCols = (text: NamePlan['text']): NameCols => ({
  language: text.language,
  content: text.content,
  content_transformed: text.contentTransformed,
});

const collator = new Intl.Collator('en-US');
const compareNullsLast = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : collator.compare(a, b);

/** Names in the read's order: the root first, then by language, content and row. */
const readOrder = (root: string, names: GlossaryEntryName[]) =>
  [...names].sort(
    (a, b) =>
      Number(b.glossaryUuid === root) - Number(a.glossaryUuid === root) ||
      compareNullsLast(a.language, b.language) ||
      compareNullsLast(a.content, b.content) ||
      (a.glossaryUuid < b.glossaryUuid
        ? -1
        : a.glossaryUuid > b.glossaryUuid
          ? 1
          : 0),
  );

/** The names rows of one call: links, in-place edits, moves and copies. */
class NameOps {
  readonly insert: GlossaryPlan['p_names_insert'] = [];
  readonly update = new Map<string, GlossaryPlan['p_names_update'][number]>();
  readonly link = new Map<string, GlossaryPlan['p_names_link'][number]>();
  /** Copies made by a relink, `names uuid > copy uuid`, once per names row. */
  readonly copies = new Map<string, string>();

  /** Whether `uuid` already has an operation in this call. */
  has(uuid: string) {
    return this.update.has(uuid) || this.link.has(uuid);
  }

  addLink(row: NameRow) {
    if (this.link.has(row.uuid)) return;
    this.link.set(row.uuid, {
      uuid: row.uuid,
      expected: pick(row, [
        'authority_uuid',
        'language',
        'content',
        'content_transformed',
      ]),
    });
  }

  addUpdate(row: NameRow, set: NameCols) {
    this.update.set(row.uuid, {
      uuid: row.uuid,
      set,
      expected: pick(row, Object.keys(set) as (keyof NameCols)[]),
    });
  }

  addInsert(
    authorityUuid: string,
    text: NamePlan['text'],
    internal: boolean | null,
  ): string {
    const uuid = uuidv4();
    this.insert.push({
      uuid,
      authority_uuid: authorityUuid,
      language: text.language,
      content: text.content,
      content_transformed: text.contentTransformed,
      internal,
    });
    return uuid;
  }
}

/** What `expect` says differs from what is stored; `null` when it all matches. */
const staleExpect = (
  entry: GlossaryEntry,
  expect: GlossaryEntryExpect | undefined,
): EntryField | null =>
  (expect &&
    ENTRY_FIELDS.find((key) => !unchangedField(key, expect[key], entry))) ??
  null;

/**
 * Each name of `list` with the stored name of the row it keeps, whether it
 * links another names row, and whether it changes the text of its own.
 */
const diffNames = (
  entry: GlossaryEntry | undefined,
  list: readonly ElementInput[],
) => {
  const current = new Map((entry?.names ?? []).map((n) => [n.glossaryUuid, n]));
  return list.map((name) => {
    const was = name.glossaryUuid ? current.get(name.glossaryUuid) : undefined;
    const link = !!name.nameUuid && name.nameUuid !== was?.nameUuid;
    return {
      name,
      was,
      link,
      textChanged: !!was && !link && !sameText(name, was),
    };
  });
};

/**
 * Plans one call. Every input check that needs stored values happens here:
 * a refusal is returned before anything is applied.
 */
export const planSave = (
  workUuid: string,
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
  stored: StoredState,
  newAuthorities: readonly GlossaryNewAuthority[] = [],
): PlannedSave | PlanFailure => {
  const plan: GlossaryPlan = {
    p_entries: [],
    p_entry_deletes: [],
    p_names_insert: [],
    p_names_update: [],
    p_names_link: [],
    p_glossaries_insert: [],
    p_glossaries_update: [],
    p_glossaries_delete: [],
    p_edges_insert: [],
    p_edges_delete: [],
  };
  const entries: GlossaryEntry[] = [];

  // New authorities that do not exist yet are created; the saves may use them.
  const authorityInserts: AuthorityInsert[] = newAuthorities
    .filter((a) => !stored.authorities.has(a.uuid))
    .map((a) => ({
      uuid: a.uuid,
      headword: a.headword.trim(),
      headword_language: a.headwordLanguage.trim(),
      definition: storedGlossaryDefinition(a.definition ?? null),
    }));
  const created = new Set(authorityInserts.map((a) => a.uuid));
  const used = new Set<string>();
  const nameRows: GlossaryNameRowChange[] = [];
  const nameRow = (
    entryUuid: string,
    { nameUuid, language, content }: GlossaryEntryName,
    action: GlossaryNameRowChange['action'],
  ) => {
    if (
      !nameRows.some(
        (r) => r.entryUuid === entryUuid && r.nameUuid === nameUuid,
      )
    ) {
      nameRows.push({ entryUuid, nameUuid, language, content, action });
    }
  };

  // Names rows any save of this call links: never edited or moved in place.
  const linkedInCall = new Set<string>();
  for (const save of saves) {
    const diff = diffNames(
      stored.entries.get(save.uuid),
      save.change.names ?? [],
    );
    for (const { name, link } of diff) {
      if (link) linkedInCall.add(name.nameUuid as string);
    }
  }
  const names = new NameOps();

  for (const save of saves) {
    const { change } = save;
    const entry = save.create ? undefined : stored.entries.get(save.uuid);
    if (save.create) {
      if (stored.takenRows.has(save.uuid)) {
        return { reason: 'exists', error: `${save.uuid} already exists` };
      }
    } else if (!entry) {
      return {
        reason: 'not-found',
        error: `${save.uuid} is not an entry of the work`,
      };
    }

    // Entry-wide values, compared with what is stored.
    const authorityUuid =
      change.authorityUuid !== undefined
        ? change.authorityUuid
        : (entry as GlossaryEntry).authorityUuid;
    const relink = !!entry && authorityUuid !== entry.authorityUuid;
    const definition =
      change.definition === undefined
        ? undefined
        : entry && change.definition === entry.definition
          ? entry.definition
          : storedGlossaryDefinition(change.definition);
    const setDefinition =
      definition !== undefined && (!entry || definition !== entry.definition);
    const setRend =
      change.definitionRend !== undefined &&
      (!entry || change.definitionRend !== entry.definitionRend);
    const setMode =
      change.glossMode !== undefined &&
      (!entry || !sameMode(change.glossMode, entry.glossMode));

    used.add(authorityUuid);
    if (relink || save.create) {
      if (
        !stored.authorities.has(authorityUuid) &&
        !created.has(authorityUuid)
      ) {
        return invalid(
          'authorityUuid',
          `Authority ${authorityUuid} does not exist`,
        );
      }
    }
    if (entry) {
      const fault =
        (setRend && checkRend(change.definitionRend)) ||
        (setMode && checkMode(change.glossMode));
      if (fault) return fault;
    }

    // Names: the list after the save, matched to the stored rows.
    const list: ElementInput[] = change.names ?? entry?.names ?? [];
    const kept = new Set<string>();
    const elements = diffNames(entry, list).map((d, i) => {
      const { name, was } = d;
      if (was) kept.add(was.glossaryUuid);
      return {
        ...d,
        i,
        row:
          save.create && i === 0 ? save.uuid : (name.glossaryUuid ?? uuidv4()),
        termTypeChanged: !was || (name.termType ?? null) !== was.termType,
        attestationChanged:
          !was || (name.attestation ?? null) !== was.attestation,
      };
    });
    const removed = (entry?.names ?? []).filter(
      (n) => !kept.has(n.glossaryUuid),
    );
    if (entry && removed.some((n) => n.glossaryUuid === entry.uuid)) {
      return invalid('names', "The entry's root name cannot be removed");
    }
    const namesChanged =
      removed.length > 0 ||
      elements.some(
        (el) =>
          !el.was ||
          el.link ||
          el.textChanged ||
          el.termTypeChanged ||
          el.attestationChanged,
      );

    for (const el of elements) {
      const at = `names[${el.i}]`;
      if (
        !el.was &&
        el.name.glossaryUuid &&
        stored.takenRows.has(el.name.glossaryUuid)
      ) {
        if (!(save.create && el.i === 0)) {
          return invalid(
            `${at}.glossaryUuid`,
            `Row ${el.name.glossaryUuid} belongs to another entry`,
          );
        }
      }
      const fault = checkWrittenName(el.name, at, {
        text: (!el.was && !el.link) || el.textChanged,
        termType: el.termTypeChanged,
        attestation: el.attestationChanged,
      });
      if (fault) return fault;
      if (el.link) {
        const linked = stored.names.get(el.name.nameUuid as string);
        if (!linked)
          return invalid(
            `${at}.nameUuid`,
            `Name ${el.name.nameUuid} does not exist`,
          );
        if (linked.authority_uuid !== authorityUuid) {
          return invalid(
            `${at}.nameUuid`,
            `Name ${linked.uuid} belongs to another authority`,
          );
        }
        if (!sameText(el.name, nameText(linked) as GlossaryEntryName)) {
          return invalid(
            `${at}.nameUuid`,
            `Name ${linked.uuid} has other text`,
          );
        }
      }
    }

    // Criterion 14: `expect` matches what is stored, and covers each change.
    if (entry) {
      const differs = staleExpect(entry, save.expect);
      if (differs)
        return stale(`${differs} of entry ${entry.uuid} has changed`);
      const changed: [boolean, keyof GlossaryEntryExpect][] = [
        [relink, 'authorityUuid'],
        [setDefinition, 'definition'],
        [setRend, 'definitionRend'],
        [setMode, 'glossMode'],
        [namesChanged, 'names'],
      ];
      const unexpected = changed.find(
        ([is, key]) => is && save.expect?.[key] === undefined,
      );
      if (unexpected) {
        return stale(
          `${unexpected[1]} of entry ${entry.uuid} changes without an expected value`,
        );
      }
    }

    plan.p_entries.push({
      uuid: save.uuid,
      rows: entry ? entry.names.map((n) => n.glossaryUuid) : [],
    });

    // Rows the entry keeps or adds, with the names row each ends up using.
    const projected: GlossaryEntryName[] = [];
    const moved = new Set<string>();
    for (const el of elements) {
      let target: NamePlan;
      const was = el.was;
      if (el.link) {
        const linked = stored.names.get(el.name.nameUuid as string) as NameRow;
        names.addLink(linked);
        target = {
          nameUuid: linked.uuid,
          authorityUuid: linked.authority_uuid,
          text: nameText(linked),
        };
      } else if (!was) {
        const text = nameText(el.name);
        target = {
          nameUuid: names.addInsert(authorityUuid, text, null),
          authorityUuid,
          text,
        };
      } else if (el.textChanged) {
        const text = nameText(el.name);
        const row = must(stored.names, was.nameUuid);
        const shared =
          stored.usedOutside.has(`${save.uuid}>${was.nameUuid}`) ||
          stored.creatorNames.has(was.nameUuid) ||
          linkedInCall.has(was.nameUuid) ||
          names.has(was.nameUuid) ||
          (entry as GlossaryEntry).names.some(
            (n) =>
              n.nameUuid === was.nameUuid &&
              n.glossaryUuid !== was.glossaryUuid,
          );
        if (shared) {
          nameRow(save.uuid, was, 'copied');
          target = {
            nameUuid: names.addInsert(authorityUuid, text, row.internal),
            authorityUuid,
            text,
          };
        } else {
          const set: NameCols = {};
          const want = textCols(text);
          for (const key of [
            'language',
            'content',
            'content_transformed',
          ] as const) {
            if (want[key] !== row[key])
              (set as Record<string, unknown>)[key] = want[key];
          }
          if (row.authority_uuid !== authorityUuid) {
            set.authority_uuid = authorityUuid;
            nameRow(save.uuid, was, 'moved');
          }
          // Never empty: the read checked the names row against the entry.
          names.addUpdate(row, set);
          target = { nameUuid: row.uuid, authorityUuid, text };
        }
      } else if (relink && was.nameAuthorityUuid !== authorityUuid) {
        // Move a names row only this entry uses, once; copy any other, once.
        const copy = names.copies.get(was.nameUuid);
        if (moved.has(was.nameUuid)) {
          target = {
            nameUuid: was.nameUuid,
            authorityUuid,
            text: nameText(was),
          };
        } else if (copy) {
          nameRow(save.uuid, was, 'copied');
          target = { nameUuid: copy, authorityUuid, text: nameText(was) };
        } else {
          const row = must(stored.names, was.nameUuid);
          const shared =
            stored.usedOutside.has(`${save.uuid}>${was.nameUuid}`) ||
            stored.creatorNames.has(was.nameUuid) ||
            linkedInCall.has(was.nameUuid) ||
            names.has(was.nameUuid);
          if (shared) {
            const uuid = names.addInsert(
              authorityUuid,
              nameText(row),
              row.internal,
            );
            names.copies.set(was.nameUuid, uuid);
            nameRow(save.uuid, was, 'copied');
            target = { nameUuid: uuid, authorityUuid, text: nameText(row) };
          } else {
            names.addUpdate(row, { authority_uuid: authorityUuid });
            moved.add(was.nameUuid);
            nameRow(save.uuid, was, 'moved');
            target = { nameUuid: row.uuid, authorityUuid, text: nameText(row) };
          }
        }
      } else {
        target = {
          nameUuid: was.nameUuid,
          authorityUuid: was.nameAuthorityUuid,
          text: nameText(was),
        };
      }

      const isRoot = el.row === save.uuid;
      const termType = el.name.termType ?? null;
      const attestation = el.name.attestation ?? null;
      if (!was) {
        plan.p_glossaries_insert.push({
          uuid: el.row,
          authority_uuid: authorityUuid,
          name_uuid: target.nameUuid,
          termType,
          attestation,
          definition: isRoot ? (definition ?? null) : null,
          definition_rend: isRoot ? (change.definitionRend ?? null) : null,
          glossMode: isRoot ? (change.glossMode ?? null) : null,
        });
        plan.p_edges_insert.push({
          parent_uuid: save.uuid,
          child_uuid: el.row,
        });
      } else {
        const row = must(stored.rows, was.glossaryUuid);
        const set: RowCols = {};
        if (relink) set.authority_uuid = authorityUuid;
        if (target.nameUuid !== row.name_uuid) set.name_uuid = target.nameUuid;
        if (el.termTypeChanged) set.termType = termType;
        if (el.attestationChanged) set.attestation = attestation;
        if (isRoot) {
          if (setDefinition) set.definition = definition ?? null;
          if (setRend) set.definition_rend = change.definitionRend ?? null;
          if (setMode) set.glossMode = change.glossMode ?? null;
        }
        if (Object.keys(set).length) {
          plan.p_glossaries_update.push({
            uuid: row.uuid,
            set,
            expected: pick(row, Object.keys(set) as (keyof RowCols)[]),
          });
        }
      }
      projected.push({
        glossaryUuid: el.row,
        nameUuid: target.nameUuid,
        nameAuthorityUuid: target.authorityUuid,
        language: target.text.language,
        content: target.text.content,
        contentTransformed: target.text.contentTransformed,
        termType,
        attestation,
      });
    }

    for (const gone of removed) {
      const row = must(stored.rows, gone.glossaryUuid);
      plan.p_edges_delete.push({
        parent_uuid: save.uuid,
        child_uuid: row.uuid,
      });
      plan.p_glossaries_delete.push({
        uuid: row.uuid,
        expected: { name_uuid: row.name_uuid },
      });
    }

    entries.push({
      uuid: save.uuid,
      workUuid,
      authorityUuid,
      definition: setDefinition
        ? (definition ?? null)
        : (entry?.definition ?? null),
      definitionRend: setRend
        ? (change.definitionRend ?? null)
        : (entry?.definitionRend ?? null),
      glossMode: (setMode ? change.glossMode : entry?.glossMode) ?? 'match',
      names: readOrder(save.uuid, projected),
    });
  }

  const unused = authorityInserts.find((a) => !used.has(a.uuid));
  if (unused) {
    return invalid(
      'authorities',
      `New authority ${unused.uuid} is not the authority of any saved entry`,
    );
  }

  // The names rows of the whole call, after every save is planned.
  plan.p_names_insert = names.insert;
  plan.p_names_update = [...names.update.values()];
  plan.p_names_link = [...names.link.values()];

  const deleted: string[] = [];
  let deletedRows = 0;
  for (const del of deletes) {
    const entry = stored.entries.get(del.uuid);
    if (!entry) {
      return {
        reason: 'not-found',
        error: `${del.uuid} is not an entry of the work`,
      };
    }
    const differs = staleExpect(entry, del.expect);
    if (differs) return stale(`${differs} of entry ${entry.uuid} has changed`);
    const rows = entry.names.map((n) => n.glossaryUuid);
    plan.p_entry_deletes.push({
      uuid: entry.uuid,
      rows,
      expected: pick(must(stored.rows, entry.uuid), [
        'authority_uuid',
        'definition',
        'definition_rend',
        'glossMode',
      ]),
    });
    deleted.push(entry.uuid);
    deletedRows += rows.length;
  }

  const changes: GlossarySaveChanges = {
    glossaries: {
      inserted: plan.p_glossaries_insert.length,
      updated: plan.p_glossaries_update.length,
      deleted: plan.p_glossaries_delete.length + deletedRows,
    },
    glossaryEdges: {
      inserted: plan.p_edges_insert.length,
      // An entry's rows each have one edge from its root, the root its self-edge.
      deleted: plan.p_edges_delete.length + deletedRows,
    },
    names: {
      inserted: plan.p_names_insert.length,
      updated: plan.p_names_update.length,
    },
    annotations: { deleted: 0 },
  };
  const writes =
    deleted.length > 0 ||
    authorityInserts.length > 0 ||
    Object.entries(plan).some(
      ([key, ops]) => key !== 'p_entries' && (ops as unknown[]).length > 0,
    );
  return {
    plan,
    entries,
    deleted,
    changes,
    authorities: authorityInserts,
    nameRows,
    writes,
  };
};

/**
 * For each existing saved entry, the names rows whose other users decide the
 * plan: those whose text the save changes, and, on a relink, those of another
 * authority. `usedOutside` must be read for these.
 */
export const usageCandidates = (
  saves: readonly GlossaryEntrySave[],
  entries: Map<string, GlossaryEntry>,
): { entry: GlossaryEntry; names: string[] }[] =>
  saves.flatMap((save) => {
    const entry = save.create ? undefined : entries.get(save.uuid);
    if (!entry) return [];
    const authorityUuid = save.change.authorityUuid ?? entry.authorityUuid;
    const candidates = new Set<string>();
    for (const was of entry.names) {
      if (
        authorityUuid !== entry.authorityUuid &&
        was.nameAuthorityUuid !== authorityUuid
      ) {
        candidates.add(was.nameUuid);
      }
    }
    for (const { was, textChanged } of diffNames(
      entry,
      save.change.names ?? [],
    )) {
      if (textChanged) candidates.add((was as GlossaryEntryName).nameUuid);
    }
    return candidates.size ? [{ entry, names: [...candidates] }] : [];
  });
