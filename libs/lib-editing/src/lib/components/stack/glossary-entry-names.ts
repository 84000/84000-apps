import type {
  GlossaryEntryName,
  GlossaryEntryNameInput,
} from '@eightyfourthousand/data-access';

/** A name as the panel holds it: stored, or added and not saved yet. */
export type PanelName = GlossaryEntryName | GlossaryEntryNameInput;

const ALTERNATIVE = 'translationAlternative';

/** The languages the panel groups, adds to and edits, in its order. */
export const NAME_GROUP_LANGUAGES = [
  'Bo-Ltn',
  'Sa-Ltn',
  'Pi-Ltn',
  'zh',
] as const;

export type NameGroupKind =
  /** The main English name: editable, never removed. */
  | 'main'
  /** English names used only for matching and search. */
  | 'alternatives'
  /** Tibetan, Sanskrit, Pali or Chinese. */
  | 'language'
  /** Any other language: listed, removable, never edited or added to. */
  | 'other';

export type NameGroup = {
  kind: NameGroupKind;
  /** The language its names are in, and new ones get. */
  language: string | null;
  names: PanelName[];
};

const collator = new Intl.Collator();
// Case aside, a name differing only in a diacritic is another name.
const sameText = new Intl.Collator(undefined, { sensitivity: 'accent' });

const byText = (a: PanelName, b: PanelName) =>
  collator.compare(a.content, b.content);

/** The entry's root, which is listed first and is never removed. */
export const isRootName = (names: readonly PanelName[], name: PanelName) =>
  names[0] === name;

/**
 * An entry's names in the panel's groups, alphabetical within each: the main
 * English name, the alternatives, the languages the panel edits, then any
 * other language under its code. A group the panel can add to is listed even
 * when empty; without a main English name there is no main group.
 */
export const groupEntryNames = (names: readonly PanelName[]): NameGroup[] => {
  const [root] = names;
  const main =
    root?.language === 'en' && root.termType !== ALTERNATIVE ? root : null;
  const rest = names.filter((name) => name !== main);
  const groups: NameGroup[] = [];
  if (main) groups.push({ kind: 'main', language: 'en', names: [main] });
  groups.push({
    kind: 'alternatives',
    language: 'en',
    names: rest.filter((name) => name.language === 'en').sort(byText),
  });
  for (const language of NAME_GROUP_LANGUAGES) {
    groups.push({
      kind: 'language',
      language,
      names: rest.filter((name) => name.language === language).sort(byText),
    });
  }
  const known = new Set<string | null>(['en', ...NAME_GROUP_LANGUAGES]);
  const others = [
    ...new Set(
      rest.map(({ language }) => language).filter((l) => !known.has(l)),
    ),
  ].sort((a, b) => collator.compare(a ?? '', b ?? ''));
  for (const language of others) {
    groups.push({
      kind: 'other',
      language,
      names: rest.filter((name) => name.language === language).sort(byText),
    });
  }
  return groups;
};

const normal = (text: string) => text.normalize('NFC').trim();

/** The text a duplicate is judged by: the script for Tibetan. */
const nameKey = (name: Pick<PanelName, 'content' | 'contentTransformed'>) =>
  normal(name.contentTransformed || name.content);

/** Whether a group already has a name with this text, besides `except`. */
export const hasSameName = (
  group: NameGroup,
  text: Pick<PanelName, 'content' | 'contentTransformed'>,
  except?: PanelName,
) => {
  const key = nameKey(text);
  return group.names.some(
    (name) => name !== except && sameText.compare(nameKey(name), key) === 0,
  );
};

/** A new name for a group, with no attestation. */
export const newName = (
  group: NameGroup,
  content: string,
  contentTransformed: string | null = null,
): GlossaryEntryNameInput => ({
  language: group.language ?? '',
  content: normal(content),
  contentTransformed: contentTransformed && normal(contentTransformed),
  termType: group.kind === 'alternatives' ? ALTERNATIVE : null,
  attestation: null,
});

export const withName = (names: readonly PanelName[], name: PanelName) => [
  ...names,
  name,
];

export const withoutName = (names: readonly PanelName[], name: PanelName) =>
  names.filter((n) => n !== name);

export const replacingName = (
  names: readonly PanelName[],
  name: PanelName,
  next: PanelName,
) => names.map((n) => (n === name ? next : n));

/** Whether a group's names take an attestation. */
export const takesAttestation = (group: NameGroup) => group.kind === 'language';
