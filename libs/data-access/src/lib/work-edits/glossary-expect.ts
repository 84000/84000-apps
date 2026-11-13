import { storedGlossaryDefinition } from '../glossary/entry/definition';
import type { GlossaryEntry, GlossaryEntryName } from '../glossary/entry/types';
import { same } from './expect';
import type { GlossaryExpect } from './types';

/** Checking a glossary op's `expect` against the stored entry. */

/** A stored name without its row uuids, as an expectation lists it. */
const plainName = (name: GlossaryEntryName) => ({
  language: name.language,
  content: name.content,
  contentTransformed: name.contentTransformed,
  termType: name.termType,
  attestation: name.attestation,
});

/**
 * Whether `expected` pairs one to one with the stored names, each item
 * matching its name on the fields it gives, in whatever order they come.
 */
const sameNames = (
  expected: NonNullable<GlossaryExpect['names']>,
  stored: readonly GlossaryEntryName[],
) => {
  if (expected.length !== stored.length) return false;
  const fits = expected.map((want) =>
    stored.flatMap((name, j) =>
      Object.entries(want).every(
        ([key, value]) =>
          value === undefined ||
          same(name[key as keyof GlossaryEntryName], value),
      )
        ? [j]
        : [],
    ),
  );
  // Bipartite matching by augmenting paths; lists are a handful of names.
  const holder: (number | undefined)[] = [];
  const place = (i: number, seen: Set<number>): boolean =>
    fits[i].some((j) => {
      if (seen.has(j)) return false;
      seen.add(j);
      const other = holder[j];
      if (other === undefined || place(other, seen)) {
        holder[j] = i;
        return true;
      }
      return false;
    });
  return expected.every((_, i) => place(i, new Set()));
};

/**
 * The first `expect` value that differs from the stored entry, described for
 * an error message; undefined when all match.
 */
export const glossaryExpectMismatch = (
  entry: GlossaryEntry,
  expect: GlossaryExpect | undefined,
): string | undefined => {
  if (!expect) return undefined;
  const stored: Record<keyof GlossaryExpect, unknown> = {
    authority: entry.authorityUuid,
    definition: entry.definition,
    definitionRend: entry.definitionRend,
    glossMode: entry.glossMode,
    names: entry.names.map(plainName),
  };
  for (const [key, expected] of Object.entries(expect)) {
    if (expected === undefined) continue;
    const field = key as keyof GlossaryExpect;
    if (!(field in stored)) {
      return `entry ${entry.uuid}: ${key} cannot be checked with expect`;
    }
    const matches =
      field === 'names'
        ? sameNames(
            expected as NonNullable<GlossaryExpect['names']>,
            entry.names,
          )
        : field === 'glossMode'
          ? (expected ?? 'match') === entry.glossMode
          : field === 'definition'
            ? same(stored[field], expected) ||
              same(
                storedGlossaryDefinition(entry.definition),
                storedGlossaryDefinition((expected as string | null) ?? null),
              )
            : same(stored[field], expected);
    if (!matches) {
      return `entry ${entry.uuid}: expected ${key} to be ${JSON.stringify(expected)} but found ${JSON.stringify(stored[field] ?? null)}. Re-read before retrying.`;
    }
  }
  return undefined;
};
