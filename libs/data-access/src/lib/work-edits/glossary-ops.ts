import { storedGlossaryDefinition } from '../glossary/entry/definition';
import { glossaryEntryChange } from '../glossary/entry/save';
import type {
  GlossaryEntry,
  GlossaryEntryChange,
  GlossaryEntryDelete,
  GlossaryEntryExpect,
  GlossaryEntrySave,
  GlossaryNewAuthority,
} from '../glossary/entry/types';
import { derivedUuid } from '../passage/derived-uuids';
import { same } from './expect';
import { glossaryExpectMismatch } from './glossary-expect';
import { matchGlossaryNames } from './glossary-names';
import { entryUuidOf } from './glossary-uuids';
import type {
  GlossaryEntryReport,
  GlossaryExpect,
  GlossaryOp,
  PatchGlossaryEntryOp,
  UpsertGlossaryEntryOp,
} from './types';

/** Turning glossary ops into one save of the editor's write path. */

/** Why the ops were refused, as the call reports it. */
export type Refusal = { error: string };

const refused = (error: string): Refusal => ({
  error: `Nothing was saved: ${error}`,
});

/** The ops as one save, with a report per entry. */
export type Planned = {
  saves: GlossaryEntrySave[];
  deletes: GlossaryEntryDelete[];
  authorities: GlossaryNewAuthority[];
  reports: GlossaryEntryReport[];
};

/**
 * A definition as it will be stored, so an equal one reads as unchanged. The
 * stored value sent back verbatim is kept as it is, even if not sanitized.
 */
const definitionChange = (
  definition: string | null | undefined,
  entry: GlossaryEntry | undefined,
) =>
  definition === undefined
    ? {}
    : {
        definition:
          entry && definition === entry.definition
            ? definition
            : storedGlossaryDefinition(definition),
      };

/** What an upsert asks the entry to be, as a save's change. */
const upsertChange = (
  op: UpsertGlossaryEntryOp,
  authorityUuid: string,
  entry: GlossaryEntry | undefined,
): GlossaryEntryChange => {
  const { definition, definitionRend, glossMode, names } = op.entry;
  return {
    authorityUuid,
    ...definitionChange(definition, entry),
    ...(definitionRend !== undefined ? { definitionRend } : {}),
    ...(glossMode !== undefined ? { glossMode } : {}),
    names: matchGlossaryNames(entry, names),
  };
};

/** The save's names for the `expect` keys of an op. */
const EXPECT_FIELDS: Record<keyof GlossaryExpect, keyof GlossaryEntryExpect> = {
  authority: 'authorityUuid',
  definition: 'definition',
  definitionRend: 'definitionRend',
  glossMode: 'glossMode',
  names: 'names',
};

/**
 * A save of a stored entry: only what differs, guarded by the stored values
 * of what it changes and of every field the op's `expect` names, so the save
 * refuses if any of them changes before it commits.
 */
const updateSave = (
  entry: GlossaryEntry,
  after: GlossaryEntryChange,
  opExpect: GlossaryExpect | undefined,
): { save: GlossaryEntrySave; changed: boolean } => {
  const { change, expect } = glossaryEntryChange(entry, after);
  const guarded: Record<string, unknown> = { ...expect };
  for (const [key, value] of Object.entries(opExpect ?? {})) {
    if (value === undefined) continue;
    const field = EXPECT_FIELDS[key as keyof GlossaryExpect];
    guarded[field] = field === 'names' ? [...entry.names] : entry[field];
  }
  return {
    save: {
      uuid: entry.uuid,
      change,
      expect: guarded as GlossaryEntryExpect,
    },
    changed: Object.keys(change).length > 0,
  };
};

/** Every entry-wide value of a stored entry, guarding a delete. */
const storedExpect = (entry: GlossaryEntry): GlossaryEntryExpect => ({
  authorityUuid: entry.authorityUuid,
  definition: entry.definition,
  definitionRend: entry.definitionRend,
  glossMode: entry.glossMode,
  names: entry.names,
});

const report = (
  uuid: string,
  action: GlossaryEntryReport['action'],
  before: GlossaryEntry | null,
): GlossaryEntryReport => ({
  uuid,
  action,
  before,
  after: null,
  copiedNames: [],
  movedNames: [],
});

/** Adds a save of a stored entry and its report. */
const addUpdate = (
  planned: Planned,
  uuid: string,
  entry: GlossaryEntry,
  after: GlossaryEntryChange,
  opExpect: GlossaryExpect | undefined,
) => {
  const { save, changed } = updateSave(entry, after, opExpect);
  planned.saves.push(save);
  planned.reports.push(report(uuid, changed ? 'update' : 'unchanged', entry));
};

/**
 * The authority an upsert names, recording one it creates in
 * `newAuthorities`; a refusal when an earlier op creates it differently.
 */
const upsertAuthority = (
  op: UpsertGlossaryEntryOp,
  uuid: string,
  newAuthorities: Map<string, GlossaryNewAuthority>,
): string | Refusal => {
  const { authority } = op.entry;
  if (typeof authority === 'string') return authority;
  const { headword, headwordLanguage, definition = null } = authority.new;
  const authorityUuid =
    authority.new.uuid ?? derivedUuid('glossary-authority', uuid);
  const created = {
    uuid: authorityUuid,
    headword,
    headwordLanguage,
    definition,
  };
  const earlier = newAuthorities.get(authorityUuid);
  if (earlier && !same(earlier, created)) {
    return refused(
      `new authority ${authorityUuid} is given twice with different values`,
    );
  }
  newAuthorities.set(authorityUuid, created);
  return authorityUuid;
};

/** The op's refusal when a patch sets a field its `expect` does not guard. */
const unguardedPatch = (
  op: PatchGlossaryEntryOp,
  uuid: string,
): Refusal | undefined => {
  const unguarded = Object.keys(op.set).find(
    (key) =>
      op.set[key as keyof typeof op.set] !== undefined &&
      op.expect?.[key as keyof GlossaryExpect] === undefined,
  );
  return unguarded
    ? refused(
        `patch-glossary-entry of ${uuid} sets ${unguarded} without an expect value for it`,
      )
    : undefined;
};

/** Turns the ops into one save, checking each against the stored entries. */
export const planOps = (
  workUuid: string,
  ops: readonly GlossaryOp[],
  stored: ReadonlyMap<string, GlossaryEntry>,
): Planned | Refusal => {
  const planned: Planned = {
    saves: [],
    deletes: [],
    authorities: [],
    reports: [],
  };
  const newAuthorities = new Map<string, GlossaryNewAuthority>();

  for (const op of ops) {
    const uuid = entryUuidOf(workUuid, op);
    const entry = stored.get(uuid);

    if (op.op === 'upsert-glossary-entry') {
      const authorityUuid = upsertAuthority(op, uuid, newAuthorities);
      if (typeof authorityUuid !== 'string') return authorityUuid;
      if (!entry) {
        if (op.expect) {
          return refused(`${uuid} has no stored entry to check expect against`);
        }
        planned.saves.push({
          uuid,
          create: true,
          change: upsertChange(op, authorityUuid, undefined),
        });
        planned.reports.push(report(uuid, 'create', null));
        continue;
      }
      const mismatch = glossaryExpectMismatch(entry, op.expect);
      if (mismatch) return refused(mismatch);
      addUpdate(
        planned,
        uuid,
        entry,
        upsertChange(op, authorityUuid, entry),
        op.expect,
      );
      continue;
    }

    if (!entry) return refused(`${uuid} is not an entry of the work`);

    if (op.op === 'patch-glossary-entry') {
      const unguarded = unguardedPatch(op, uuid);
      if (unguarded) return unguarded;
      const mismatch = glossaryExpectMismatch(entry, op.expect);
      if (mismatch) return refused(mismatch);
      const { names, definition, ...values } = op.set;
      addUpdate(
        planned,
        uuid,
        entry,
        {
          ...values,
          ...definitionChange(definition, entry),
          ...(names ? { names: matchGlossaryNames(entry, names) } : {}),
        },
        op.expect,
      );
      continue;
    }

    if (op.op === 'relink-glossary-entry') {
      if (op.expect?.authority === undefined) {
        return refused(
          `relink-glossary-entry of ${uuid} needs expect.authority`,
        );
      }
      const mismatch = glossaryExpectMismatch(entry, op.expect);
      if (mismatch) return refused(mismatch);
      addUpdate(
        planned,
        uuid,
        entry,
        { authorityUuid: op.authority },
        op.expect,
      );
      continue;
    }

    const mismatch = glossaryExpectMismatch(entry, op.expect);
    if (mismatch) return refused(mismatch);
    planned.deletes.push({ uuid, expect: storedExpect(entry) });
    planned.reports.push(report(uuid, 'delete', entry));
  }
  planned.authorities = [...newAuthorities.values()];
  return planned;
};
