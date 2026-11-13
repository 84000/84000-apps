import { storedGlossaryDefinition } from './definition';
import {
  checkMode,
  checkRend,
  checkWrittenName,
  invalid,
  stale,
} from './plan-check';
import { diffNames, readOrder, sameText, staleExpect } from './plan-compare';
import { nameText, NameOps, type EntryNames } from './plan-names';
import {
  elementsOf,
  entryValues,
  planRow,
  type PlannedName,
} from './plan-rows';
import type {
  AuthorityInsert,
  GlossaryPlan,
  PlanFailure,
  PlannedSave,
  StoredState,
} from './plan-types';
import { must, pick } from './plan-util';
import type {
  GlossaryEntry,
  GlossaryEntryDelete,
  GlossaryEntryExpect,
  GlossaryEntryName,
  GlossaryEntrySave,
  GlossaryNewAuthority,
  GlossarySaveChanges,
} from './types';

/**
 * Planning a glossary save: from the caller's saves and deletes and the
 * stored state, the explicit row operations `apply_glossary_save` applies.
 * Everything here is pure; `stored.ts` reads what it needs.
 */

/** What every save of one call shares. */
type CallState = {
  workUuid: string;
  stored: StoredState;
  plan: GlossaryPlan;
  names: NameOps;
  /** Names rows any save of this call links. */
  linkedInCall: ReadonlySet<string>;
  /** Authorities the call creates. */
  created: ReadonlySet<string>;
  /** Authorities the saves end up using. */
  used: Set<string>;
};

const emptyPlan = (): GlossaryPlan => ({
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
});

/** Checks the save's names against the stored state. */
const checkElements = (
  call: CallState,
  save: GlossaryEntrySave,
  elements: readonly PlannedName[],
  authorityUuid: string,
): PlanFailure | null => {
  for (const el of elements) {
    const at = `names[${el.i}]`;
    if (
      !el.was &&
      el.name.glossaryUuid &&
      call.stored.takenRows.has(el.name.glossaryUuid) &&
      !(save.create && el.i === 0)
    ) {
      return invalid(
        `${at}.glossaryUuid`,
        `Row ${el.name.glossaryUuid} belongs to another entry`,
      );
    }
    const fault = checkWrittenName(el.name, at, {
      text: (!el.was && !el.link) || el.textChanged,
      termType: el.termTypeChanged,
      attestation: el.attestationChanged,
    });
    if (fault) return fault;
    if (!el.link) continue;
    const linked = call.stored.names.get(el.name.nameUuid as string);
    if (!linked) {
      return invalid(
        `${at}.nameUuid`,
        `Name ${el.name.nameUuid} does not exist`,
      );
    }
    if (linked.authority_uuid !== authorityUuid) {
      return invalid(
        `${at}.nameUuid`,
        `Name ${linked.uuid} belongs to another authority`,
      );
    }
    if (!sameText(el.name, nameText(linked) as GlossaryEntryName)) {
      return invalid(`${at}.nameUuid`, `Name ${linked.uuid} has other text`);
    }
  }
  return null;
};

/** Whether `expect` matches what is stored, and covers each change. */
const checkExpect = (
  entry: GlossaryEntry,
  expect: GlossaryEntryExpect | undefined,
  changed: [boolean, keyof GlossaryEntryExpect][],
): PlanFailure | null => {
  const differs = staleExpect(entry, expect);
  if (differs) return stale(`${differs} of entry ${entry.uuid} has changed`);
  const unexpected = changed.find(
    ([is, key]) => is && expect?.[key] === undefined,
  );
  return unexpected
    ? stale(
        `${unexpected[1]} of entry ${entry.uuid} changes without an expected value`,
      )
    : null;
};

/**
 * Plans one save into the call's plan. Every check that needs stored values
 * happens before anything is added.
 */
const planEntry = (
  call: CallState,
  save: GlossaryEntrySave,
): GlossaryEntry | PlanFailure => {
  const { plan, stored } = call;
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

  const values = entryValues(save, entry);
  const { authorityUuid, relink } = values;
  call.used.add(authorityUuid);
  if (
    (relink || save.create) &&
    !stored.authorities.has(authorityUuid) &&
    !call.created.has(authorityUuid)
  ) {
    return invalid(
      'authorityUuid',
      `Authority ${authorityUuid} does not exist`,
    );
  }
  if (entry) {
    const fault =
      (values.setRend && checkRend(change.definitionRend)) ||
      (values.setMode && checkMode(change.glossMode));
    if (fault) return fault;
  }

  const elements = elementsOf(save, entry);
  const kept = new Set(elements.flatMap((el) => el.was?.glossaryUuid ?? []));
  const removed = (entry?.names ?? []).filter((n) => !kept.has(n.glossaryUuid));
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

  const fault =
    checkElements(call, save, elements, authorityUuid) ??
    (entry
      ? checkExpect(entry, save.expect, [
          [relink, 'authorityUuid'],
          [values.setDefinition, 'definition'],
          [values.setRend, 'definitionRend'],
          [values.setMode, 'glossMode'],
          [namesChanged, 'names'],
        ])
      : null);
  if (fault) return fault;

  plan.p_entries.push({
    uuid: save.uuid,
    rows: entry ? entry.names.map((n) => n.glossaryUuid) : [],
  });

  // Rows the entry keeps or adds, with the names row each ends up using.
  const at: EntryNames = {
    stored,
    names: call.names,
    linkedInCall: call.linkedInCall,
    uuid: save.uuid,
    entry,
    authorityUuid,
    relink,
    moved: new Set(),
  };
  const projected = elements.map((el) => planRow(plan, save, values, el, at));

  for (const gone of removed) {
    const row = must(stored.rows, gone.glossaryUuid);
    plan.p_edges_delete.push({ parent_uuid: save.uuid, child_uuid: row.uuid });
    plan.p_glossaries_delete.push({
      uuid: row.uuid,
      expected: { name_uuid: row.name_uuid },
    });
  }

  return {
    uuid: save.uuid,
    workUuid: call.workUuid,
    authorityUuid,
    definition: values.setDefinition
      ? (values.definition ?? null)
      : (entry?.definition ?? null),
    definitionRend: values.setRend
      ? (change.definitionRend ?? null)
      : (entry?.definitionRend ?? null),
    glossMode:
      (values.setMode ? change.glossMode : entry?.glossMode) ?? 'match',
    names: readOrder(save.uuid, projected),
  };
};

/** Plans the deletes into `plan`; returns the deleted entries and their row count. */
const planDeletes = (
  plan: GlossaryPlan,
  deletes: readonly GlossaryEntryDelete[],
  stored: StoredState,
): { deleted: string[]; rows: number } | PlanFailure => {
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
  return { deleted, rows: deletedRows };
};

/** The plan's row counts, but for annotations. */
const countChanges = (
  plan: GlossaryPlan,
  deletedRows: number,
): GlossarySaveChanges => ({
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
});

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
  // New authorities that do not exist yet are created; the saves may use them.
  const authorityInserts: AuthorityInsert[] = newAuthorities
    .filter((a) => !stored.authorities.has(a.uuid))
    .map((a) => ({
      uuid: a.uuid,
      headword: a.headword.trim(),
      headword_language: a.headwordLanguage.trim(),
      definition: storedGlossaryDefinition(a.definition ?? null),
    }));
  const call: CallState = {
    workUuid,
    stored,
    plan: emptyPlan(),
    names: new NameOps(),
    // Never edited or moved in place.
    linkedInCall: new Set(
      saves.flatMap((save) =>
        diffNames(stored.entries.get(save.uuid), save.change.names ?? [])
          .filter((d) => d.link)
          .map((d) => d.name.nameUuid as string),
      ),
    ),
    created: new Set(authorityInserts.map((a) => a.uuid)),
    used: new Set(),
  };
  const { plan, names } = call;

  const entries: GlossaryEntry[] = [];
  for (const save of saves) {
    const planned = planEntry(call, save);
    if ('reason' in planned) return planned;
    entries.push(planned);
  }

  const unused = authorityInserts.find((a) => !call.used.has(a.uuid));
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

  const removal = planDeletes(plan, deletes, stored);
  if ('reason' in removal) return removal;
  const { deleted } = removal;

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
    changes: countChanges(plan, removal.rows),
    authorities: authorityInserts,
    nameRows: names.changes,
    writes,
  };
};
