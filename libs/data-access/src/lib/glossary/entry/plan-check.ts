import { isUuid } from '@eightyfourthousand/lib-utils';

import type { ElementInput, PlanFailure } from './plan-types';
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_MODES,
  GLOSSARY_TERM_TYPES,
  type GlossaryEntryDelete,
  type GlossaryEntrySave,
  type GlossaryNewAuthority,
} from './types';

/** Checks of a save's input values: refusals, never writes. */

const ATTESTATIONS = new Set<string>(GLOSSARY_ATTESTATIONS);
const RENDS = new Set<string>(GLOSSARY_DEFINITION_RENDS);
const MODES = new Set<string>(GLOSSARY_MODES);
const TERM_TYPES = new Set<string>(GLOSSARY_TERM_TYPES);

/** An `invalid` refusal of `field`. */
export const invalid = (field: string, error: string): PlanFailure => ({
  reason: 'invalid',
  error,
  field,
});

/** A `stale` refusal. */
export const stale = (error: string): PlanFailure => ({
  reason: 'stale',
  error,
});

/** Checks a written name's fixed values; `null` when they are fine. */
export const checkWrittenName = (
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

/** Refuses an unknown definition rend. */
export const checkRend = (value: string | null | undefined) =>
  value == null || RENDS.has(value)
    ? null
    : invalid('definitionRend', `Unknown definition rend ${value}`);

/** Refuses an unknown matching mode. */
export const checkMode = (value: string | null | undefined) =>
  value == null || MODES.has(value)
    ? null
    : invalid('glossMode', `Unknown matching mode ${value}`);

const checkAuthorities = (
  authorities: readonly GlossaryNewAuthority[],
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
  return null;
};

/** Checks one save's names; `rows` maps each listed row to its entry. */
const checkSaveNames = (
  save: GlossaryEntrySave,
  entries: ReadonlySet<string>,
  rows: Map<string, string>,
): PlanFailure | null => {
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
  return null;
};

/** Checks the values of the names `written` picks: they are all written. */
const checkWrittenNames = (
  names: readonly ElementInput[],
  written: (name: ElementInput) => boolean,
) =>
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

/** Checks a save's entry-wide values and the names it writes. */
const checkSaveValues = (save: GlossaryEntrySave): PlanFailure | null => {
  const names = save.change.names ?? [];
  if (!save.create) {
    const { authorityUuid } = save.change;
    if (authorityUuid !== undefined && !isUuid(authorityUuid)) {
      return invalid('authorityUuid', `${authorityUuid} is not a uuid`);
    }
    // A name without a row is new, so all its values are written.
    return checkWrittenNames(names, (name) => !name.glossaryUuid);
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
  return (
    checkRend(definitionRend) ??
    checkMode(glossMode) ??
    checkWrittenNames(names, () => true)
  );
};

/**
 * Refuses input that is invalid whatever is stored: malformed or repeated
 * uuids, a create's values (a create writes all of them) and a new name's.
 */
export const checkInput = (
  saves: readonly GlossaryEntrySave[],
  deletes: readonly GlossaryEntryDelete[],
  authorities: readonly GlossaryNewAuthority[] = [],
): PlanFailure | null => {
  const authorityFault = checkAuthorities(authorities);
  if (authorityFault) return authorityFault;

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
    const fault = checkSaveNames(save, entries, rows) ?? checkSaveValues(save);
    if (fault) return fault;
  }
  return null;
};
