import { v4 as uuidv4 } from 'uuid';

import { storedGlossaryDefinition } from './definition';
import { diffNames, sameMode } from './plan-compare';
import { must, pick, planName, type EntryNames } from './plan-names';
import type { ElementInput, GlossaryPlan, RowCols } from './plan-types';
import type {
  GlossaryEntry,
  GlossaryEntryName,
  GlossaryEntrySave,
} from './types';

/**
 * A save's values compared with the stored entry, and the `glossaries` row
 * operations for each of its names.
 */

/** A save's entry-wide values, after the save. */
export type EntryValues = {
  authorityUuid: string;
  relink: boolean;
  definition: string | null | undefined;
  setDefinition: boolean;
  setRend: boolean;
  setMode: boolean;
};

/** A name of the save, matched to the stored row it keeps. */
export type Element = ReturnType<typeof diffNames>[number] & {
  i: number;
  /** The `glossaries` row of the name after the save. */
  row: string;
  termTypeChanged: boolean;
  attestationChanged: boolean;
};

export const entryValues = (
  save: GlossaryEntrySave,
  entry: GlossaryEntry | undefined,
): EntryValues => {
  const { change } = save;
  const authorityUuid =
    change.authorityUuid !== undefined
      ? change.authorityUuid
      : (entry as GlossaryEntry).authorityUuid;
  const definition =
    change.definition === undefined
      ? undefined
      : entry && change.definition === entry.definition
        ? entry.definition
        : storedGlossaryDefinition(change.definition);
  return {
    authorityUuid,
    relink: !!entry && authorityUuid !== entry.authorityUuid,
    definition,
    setDefinition:
      definition !== undefined && (!entry || definition !== entry.definition),
    setRend:
      change.definitionRend !== undefined &&
      (!entry || change.definitionRend !== entry.definitionRend),
    setMode:
      change.glossMode !== undefined &&
      (!entry || !sameMode(change.glossMode, entry.glossMode)),
  };
};

/** The save's names list, matched to the stored rows. */
export const elementsOf = (
  save: GlossaryEntrySave,
  entry: GlossaryEntry | undefined,
): Element[] => {
  const list: ElementInput[] = save.change.names ?? entry?.names ?? [];
  return diffNames(entry, list).map((d, i) => ({
    ...d,
    i,
    row: save.create && i === 0 ? save.uuid : (d.name.glossaryUuid ?? uuidv4()),
    termTypeChanged: !d.was || (d.name.termType ?? null) !== d.was.termType,
    attestationChanged:
      !d.was || (d.name.attestation ?? null) !== d.was.attestation,
  }));
};

/** Adds the `glossaries` row operations for one name; returns it as stored. */
export const planRow = (
  plan: GlossaryPlan,
  save: GlossaryEntrySave,
  values: EntryValues,
  el: Element,
  names: EntryNames,
): GlossaryEntryName => {
  const { change } = save;
  const { authorityUuid, definition } = values;
  const target = planName(names, el);
  const isRoot = el.row === save.uuid;
  const termType = el.name.termType ?? null;
  const attestation = el.name.attestation ?? null;
  if (!el.was) {
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
    plan.p_edges_insert.push({ parent_uuid: save.uuid, child_uuid: el.row });
  } else {
    const row = must(names.stored.rows, el.was.glossaryUuid);
    const set: RowCols = {};
    if (values.relink) set.authority_uuid = authorityUuid;
    if (target.nameUuid !== row.name_uuid) set.name_uuid = target.nameUuid;
    if (el.termTypeChanged) set.termType = termType;
    if (el.attestationChanged) set.attestation = attestation;
    if (isRoot) {
      if (values.setDefinition) set.definition = definition ?? null;
      if (values.setRend) set.definition_rend = change.definitionRend ?? null;
      if (values.setMode) set.glossMode = change.glossMode ?? null;
    }
    if (Object.keys(set).length) {
      plan.p_glossaries_update.push({
        uuid: row.uuid,
        set,
        expected: pick(row, Object.keys(set) as (keyof RowCols)[]),
      });
    }
  }
  return {
    glossaryUuid: el.row,
    nameUuid: target.nameUuid,
    nameAuthorityUuid: target.authorityUuid,
    language: target.text.language,
    content: target.text.content,
    contentTransformed: target.text.contentTransformed,
    termType,
    attestation,
  };
};
