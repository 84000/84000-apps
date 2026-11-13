import type {
  GlossaryEntry,
  GlossaryEntryName,
  GlossaryEntryNameInput,
} from '../glossary/entry/types';
import type { GlossaryNameInput } from './types';

/** Matching an op's names to the stored names rows of the entry. */

/** A name as the save takes it, the stored values filling what `name` omits. */
const nameInput = (
  name: GlossaryNameInput,
  was: GlossaryEntryName | undefined,
): GlossaryEntryNameInput => ({
  ...(was ? { glossaryUuid: was.glossaryUuid } : {}),
  ...(name.glossaryUuid ? { glossaryUuid: name.glossaryUuid } : {}),
  language: name.language,
  content: name.content,
  // The stored script belongs to the stored text: a changed name needs its own.
  contentTransformed:
    name.contentTransformed !== undefined
      ? name.contentTransformed
      : was && was.language === name.language && was.content === name.content
        ? was.contentTransformed
        : null,
  termType:
    name.termType !== undefined ? name.termType : (was?.termType ?? null),
  attestation:
    name.attestation !== undefined
      ? name.attestation
      : (was?.attestation ?? null),
});

/**
 * The entry's name list after the op, each name matched to a stored row: by
 * `glossaryUuid` when given; else the first name to the root, the rest to a
 * stored name with the same language and content, then to one with the same
 * language. Unmatched names are new; unmatched stored names are dropped.
 */
export const matchGlossaryNames = (
  entry: GlossaryEntry | undefined,
  names: readonly GlossaryNameInput[],
): GlossaryEntryNameInput[] => {
  const stored = new Map(
    (entry?.names ?? []).map((name) => [name.glossaryUuid, name]),
  );
  const matched = new Map<number, GlossaryEntryName>();
  const take = (i: number, name: GlossaryEntryName | undefined) => {
    if (!name) return;
    matched.set(i, name);
    stored.delete(name.glossaryUuid);
  };
  const open = () =>
    names.flatMap((name, i) =>
      matched.has(i) || name.glossaryUuid ? [] : [i],
    );

  for (const [i, name] of names.entries()) {
    if (name.glossaryUuid) take(i, stored.get(name.glossaryUuid));
  }
  if (entry && names.length && !names[0].glossaryUuid) {
    take(0, stored.get(entry.uuid));
  }
  const rules: ((a: GlossaryNameInput, b: GlossaryEntryName) => boolean)[] = [
    (a, b) => a.language === b.language && a.content === b.content,
    (a, b) => a.language === b.language,
  ];
  for (const rule of rules) {
    for (const i of open()) {
      take(
        i,
        [...stored.values()].find(
          (was) => was.glossaryUuid !== entry?.uuid && rule(names[i], was),
        ),
      );
    }
  }
  return names.map((name, i) => nameInput(name, matched.get(i)));
};
