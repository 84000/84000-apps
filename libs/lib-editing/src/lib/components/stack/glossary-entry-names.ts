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

/** The group a name's language belongs in: any Chinese code is Chinese. */
const groupLanguage = (language: string | null) =>
  language && /^zh(-|$)/i.test(language) ? 'zh' : language;

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
      names: rest
        .filter((name) => groupLanguage(name.language) === language)
        .sort(byText),
    });
  }
  const known = new Set<string | null>(['en', ...NAME_GROUP_LANGUAGES]);
  const others = [
    ...new Set(
      rest
        .map(({ language }) => language)
        .filter((l) => !known.has(groupLanguage(l))),
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

type NameText = Pick<PanelName, 'content' | 'contentTransformed'>;

const same = (a: string | null, b: string | null) =>
  !!a && !!b && sameText.compare(normal(a), normal(b)) === 0;

// Case is meaningful in Wylie: "Ta" and "ta" are different letters.
const sameWylie = (a: string, b: string) => normal(a) === normal(b);

/**
 * Whether a group already has a name with this text, besides `except`. A
 * Tibetan name matches by its script or its Wylie, since some stored names
 * have no script.
 */
export const hasSameName = (
  group: NameGroup,
  text: NameText,
  except?: PanelName,
) =>
  group.names.some(
    (name) =>
      name !== except &&
      (group.language === 'Bo-Ltn'
        ? sameWylie(name.content, text.content) ||
          same(name.contentTransformed, text.contentTransformed)
        : same(name.content, text.content)),
  );

/** A name's text as entered, normalized as stored. */
export const enteredText = (text: NameText): NameText => ({
  content: normal(text.content),
  contentTransformed:
    text.contentTransformed && normal(text.contentTransformed),
});

/** A new name for a group, with no attestation. */
export const newName = (
  group: NameGroup,
  content: string,
  contentTransformed: string | null = null,
): GlossaryEntryNameInput => ({
  language: group.language ?? '',
  ...enteredText({ content, contentTransformed }),
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
