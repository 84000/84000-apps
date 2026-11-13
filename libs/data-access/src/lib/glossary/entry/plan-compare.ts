import type { ElementInput } from './plan-types';
import type {
  GlossaryEntry,
  GlossaryEntryChange,
  GlossaryEntryExpect,
  GlossaryEntryName,
} from './types';

/**
 * Comparing a save's values with the stored entry: what it changes, and
 * whether its expectations still hold.
 */

/** Whether two matching modes are the same, `null` being `match`. */
export const sameMode = (
  a: string | null | undefined,
  b: string | null | undefined,
) => (a ?? 'match') === (b ?? 'match');

/** Whether a name's text is the stored name's. */
export const sameText = (
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

/** An entry-wide field a save changes and an expectation guards. */
export type EntryField = keyof Required<GlossaryEntryExpect>;

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

/** What `expect` says differs from what is stored; `null` when it all matches. */
export const staleExpect = (
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
export const diffNames = (
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

const collator = new Intl.Collator('en-US');
const compareNullsLast = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : collator.compare(a, b);

/** Names in the read's order: the root first, then by language, content and row. */
export const readOrder = (root: string, names: GlossaryEntryName[]) =>
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
