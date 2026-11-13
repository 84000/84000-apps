import { v4 as uuidv4 } from 'uuid';

import type { diffNames } from './plan-compare';
import type {
  ElementInput,
  GlossaryPlan,
  NameCols,
  NameRow,
  StoredState,
} from './plan-types';
import type {
  GlossaryEntry,
  GlossaryEntryName,
  GlossaryNameRowChange,
} from './types';

/**
 * Planning the `names` rows of a save: which row each of an entry's names
 * ends up using, and the links, edits, moves and copies that takes.
 */

/**
 * A stored value `readStored` guarantees: it refuses reads that disagree, so
 * a missing one is a bug, not a concurrent change.
 */
export const must = <K, V>(map: ReadonlyMap<K, V>, key: K): V => {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`The stored state has nothing for ${String(key)}`);
  }
  return value;
};

/** `row`'s values of `keys`. */
export const pick = <T extends object, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Pick<T, K> => {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = row[key];
  return out;
};

/** The names row a name ends up using. */
export type NamePlan = {
  nameUuid: string;
  authorityUuid: string;
  text: Pick<GlossaryEntryName, 'language' | 'content' | 'contentTransformed'>;
};

/** A name's text, from the input, the entry or a `names` row. */
export const nameText = (name: ElementInput | NameRow) =>
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

/** The names rows of one call: links, in-place edits, moves and copies. */
export class NameOps {
  readonly insert: GlossaryPlan['p_names_insert'] = [];
  readonly update = new Map<string, GlossaryPlan['p_names_update'][number]>();
  readonly link = new Map<string, GlossaryPlan['p_names_link'][number]>();
  /** Copies made by a relink, `names uuid > copy uuid`, once per names row. */
  readonly copies = new Map<string, string>();
  /** The names rows the saves copy or move, once per entry. */
  readonly changes: GlossaryNameRowChange[] = [];

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

  /** Reports that an entry copies or moves the names row of `name`. */
  report(
    entryUuid: string,
    { nameUuid, language, content }: GlossaryEntryName,
    action: GlossaryNameRowChange['action'],
  ) {
    if (
      !this.changes.some(
        (r) => r.entryUuid === entryUuid && r.nameUuid === nameUuid,
      )
    ) {
      this.changes.push({ entryUuid, nameUuid, language, content, action });
    }
  }
}

/** One save's names, planned together. */
export type EntryNames = {
  stored: StoredState;
  names: NameOps;
  /** Names rows any save of this call links: never edited or moved in place. */
  linkedInCall: ReadonlySet<string>;
  /** The saved entry's uuid. */
  uuid: string;
  /** The saved entry as stored; absent for a create. */
  entry: GlossaryEntry | undefined;
  /** The entry's authority after the save. */
  authorityUuid: string;
  /** Whether the save changes the entry's authority. */
  relink: boolean;
  /** Names rows this save moves to its new authority. */
  moved: Set<string>;
};

type NameDiff = ReturnType<typeof diffNames>[number];

/** Whether a names row has users this save must not change under them. */
const usedElsewhere = (at: EntryNames, nameUuid: string) =>
  at.stored.usedOutside.has(`${at.uuid}>${nameUuid}`) ||
  at.stored.creatorNames.has(nameUuid) ||
  at.linkedInCall.has(nameUuid) ||
  at.names.has(nameUuid);

/** A name whose text changes: edit its names row, or copy a shared one. */
const editedText = (
  at: EntryNames,
  name: ElementInput,
  was: GlossaryEntryName,
): NamePlan => {
  const { authorityUuid, names } = at;
  const text = nameText(name);
  const row = must(at.stored.names, was.nameUuid);
  const shared =
    usedElsewhere(at, was.nameUuid) ||
    (at.entry as GlossaryEntry).names.some(
      (n) => n.nameUuid === was.nameUuid && n.glossaryUuid !== was.glossaryUuid,
    );
  if (shared) {
    names.report(at.uuid, was, 'copied');
    return {
      nameUuid: names.addInsert(authorityUuid, text, row.internal),
      authorityUuid,
      text,
    };
  }
  const set: NameCols = {};
  const want = textCols(text);
  for (const key of ['language', 'content', 'content_transformed'] as const) {
    if (want[key] !== row[key])
      (set as Record<string, unknown>)[key] = want[key];
  }
  if (row.authority_uuid !== authorityUuid) {
    set.authority_uuid = authorityUuid;
    names.report(at.uuid, was, 'moved');
  }
  // Never empty: the read checked the names row against the entry.
  names.addUpdate(row, set);
  return { nameUuid: row.uuid, authorityUuid, text };
};

/** A kept name on a relink: move a names row only this entry uses, once; copy any other, once. */
const relinked = (at: EntryNames, was: GlossaryEntryName): NamePlan => {
  const { authorityUuid, names } = at;
  const copy = names.copies.get(was.nameUuid);
  if (at.moved.has(was.nameUuid)) {
    return { nameUuid: was.nameUuid, authorityUuid, text: nameText(was) };
  }
  if (copy) {
    names.report(at.uuid, was, 'copied');
    return { nameUuid: copy, authorityUuid, text: nameText(was) };
  }
  const row = must(at.stored.names, was.nameUuid);
  if (usedElsewhere(at, was.nameUuid)) {
    const uuid = names.addInsert(authorityUuid, nameText(row), row.internal);
    names.copies.set(was.nameUuid, uuid);
    names.report(at.uuid, was, 'copied');
    return { nameUuid: uuid, authorityUuid, text: nameText(row) };
  }
  names.addUpdate(row, { authority_uuid: authorityUuid });
  at.moved.add(was.nameUuid);
  names.report(at.uuid, was, 'moved');
  return { nameUuid: row.uuid, authorityUuid, text: nameText(row) };
};

/**
 * The names row a name of the save ends up using, adding the operations that
 * takes. Its input has been checked against the stored state.
 */
export const planName = (
  at: EntryNames,
  { name, was, link, textChanged }: NameDiff,
): NamePlan => {
  if (link) {
    const linked = at.stored.names.get(name.nameUuid as string) as NameRow;
    at.names.addLink(linked);
    return {
      nameUuid: linked.uuid,
      authorityUuid: linked.authority_uuid,
      text: nameText(linked),
    };
  }
  if (!was) {
    const text = nameText(name);
    return {
      nameUuid: at.names.addInsert(at.authorityUuid, text, null),
      authorityUuid: at.authorityUuid,
      text,
    };
  }
  if (textChanged) return editedText(at, name, was);
  if (at.relink && was.nameAuthorityUuid !== at.authorityUuid) {
    return relinked(at, was);
  }
  return {
    nameUuid: was.nameUuid,
    authorityUuid: was.nameAuthorityUuid,
    text: nameText(was),
  };
};
