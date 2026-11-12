import { readEntries } from '../glossary/entry/stored';
import {
  glossaryEntryChange,
  NO_CHANGES,
  saveGlossaryEntries,
  storedGlossaryDefinition,
} from '../glossary/entry/save';
import type {
  GlossaryEntry,
  GlossaryEntryChange,
  GlossaryEntryDelete,
  GlossaryEntryExpect,
  GlossaryEntryName,
  GlossaryEntryNameInput,
  GlossaryEntrySave,
  GlossaryNewAuthority,
  GlossarySaveResult,
} from '../glossary/entry/types';
import { derivedUuid } from '../passage/derived-uuids';
import { stableStringify } from '../passage/save/diff';
import type { DataClient } from '../types';
import type {
  GlossaryChanges,
  GlossaryEntryReport,
  GlossaryExpect,
  GlossaryNameInput,
  GlossaryOp,
  GroupCommit,
  GroupPlan,
  UpsertGlossaryEntryOp,
} from './types';

const empty = (): GlossaryChanges => ({
  group: 'glossary',
  entries: [],
  authorities: [],
  rows: NO_CHANGES,
});

type Refusal = { error: string };

const refused = (error: string): Refusal => ({
  error: `Nothing was saved: ${error}`,
});

const lower = <T extends string | undefined>(uuid: T): T =>
  (uuid?.toLowerCase() ?? uuid) as T;

const lowerNames = <N extends { glossaryUuid?: string }>(names: readonly N[]) =>
  names.map((name) => ({ ...name, glossaryUuid: lower(name.glossaryUuid) }));

const lowerExpect = (expect: GlossaryExpect | undefined) =>
  expect && { ...expect, authority: lower(expect.authority) };

/**
 * The op with its uuids in lowercase, the form they are stored and derived
 * in; a uuid given in uppercase names the same row.
 */
const lowerUuids = (op: GlossaryOp): GlossaryOp => {
  switch (op.op) {
    case 'upsert-glossary-entry': {
      const { authority } = op.entry;
      return {
        ...op,
        entry: {
          ...op.entry,
          uuid: lower(op.entry.uuid),
          authority:
            typeof authority === 'string'
              ? lower(authority)
              : { new: { ...authority.new, uuid: lower(authority.new.uuid) } },
          names: lowerNames(op.entry.names),
        },
        expect: lowerExpect(op.expect),
      };
    }
    case 'patch-glossary-entry':
      return {
        ...op,
        uuid: lower(op.uuid),
        set: {
          ...op.set,
          ...(op.set.names ? { names: lowerNames(op.set.names) } : {}),
        },
        expect: lowerExpect(op.expect) as GlossaryExpect,
      };
    case 'relink-glossary-entry':
      return {
        ...op,
        uuid: lower(op.uuid),
        authority: lower(op.authority),
        expect: op.expect && { authority: lower(op.expect.authority) },
      };
    case 'delete-glossary-entry':
      return { ...op, uuid: lower(op.uuid), expect: lowerExpect(op.expect) };
  }
};

/** The uuid an upserted entry gets when it arrives without one. */
const upsertEntryUuid = (workUuid: string, op: UpsertGlossaryEntryOp) => {
  const { entry } = op;
  if (entry.uuid) return entry.uuid;
  const { authority } = entry;
  const authorityKey =
    typeof authority === 'string'
      ? authority
      : (authority.new.uuid ??
        `new:${authority.new.headwordLanguage}:${authority.new.headword}`);
  const root = entry.names[0];
  return derivedUuid(
    'glossary-entry',
    workUuid,
    authorityKey,
    root?.language ?? '',
    root?.content ?? '',
  );
};

/** The entry uuid an op names. */
const entryUuidOf = (workUuid: string, op: GlossaryOp) =>
  op.op === 'upsert-glossary-entry' ? upsertEntryUuid(workUuid, op) : op.uuid;

// ---------------------------------------------------------------- expect

const same = (a: unknown, b: unknown) =>
  stableStringify(a ?? null) === stableStringify(b ?? null);

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
const expectMismatch = (
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
                stored[field],
                storedGlossaryDefinition((expected as string | null) ?? null),
              )
            : same(stored[field], expected);
    if (!matches) {
      return `entry ${entry.uuid}: expected ${key} to be ${JSON.stringify(expected)} but found ${JSON.stringify(stored[field] ?? null)}. Re-read before retrying.`;
    }
  }
  return undefined;
};

// ---------------------------------------------------------------- names

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

// ---------------------------------------------------------------- the plan

type Planned = {
  saves: GlossaryEntrySave[];
  deletes: GlossaryEntryDelete[];
  authorities: GlossaryNewAuthority[];
  reports: GlossaryEntryReport[];
};

/** A definition as it will be stored, so an equal one reads as unchanged. */
const definitionChange = (definition: string | null | undefined) =>
  definition !== undefined
    ? { definition: storedGlossaryDefinition(definition) }
    : {};

/** What an upsert asks the entry to be, as a save's change. */
const upsertChange = (
  op: UpsertGlossaryEntryOp,
  authorityUuid: string,
  entry: GlossaryEntry | undefined,
): GlossaryEntryChange => {
  const { definition, definitionRend, glossMode, names } = op.entry;
  return {
    authorityUuid,
    ...definitionChange(definition),
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

/** Turns the ops into one save, checking each against the stored entries. */
const planOps = (
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
    const missing = () => refused(`${uuid} is not an entry of the work`);

    if (op.op === 'upsert-glossary-entry') {
      const { authority } = op.entry;
      let authorityUuid: string;
      if (typeof authority === 'string') {
        authorityUuid = authority;
      } else {
        const { headword, headwordLanguage, definition = null } = authority.new;
        authorityUuid =
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
      }
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
      const mismatch = expectMismatch(entry, op.expect);
      if (mismatch) return refused(mismatch);
      const { save, changed } = updateSave(
        entry,
        upsertChange(op, authorityUuid, entry),
        op.expect,
      );
      planned.saves.push(save);
      planned.reports.push(
        report(uuid, changed ? 'update' : 'unchanged', entry),
      );
      continue;
    }

    if (!entry) return missing();

    if (op.op === 'patch-glossary-entry') {
      const unguarded = Object.keys(op.set).find(
        (key) =>
          op.set[key as keyof typeof op.set] !== undefined &&
          op.expect?.[key as keyof GlossaryExpect] === undefined,
      );
      if (unguarded) {
        return refused(
          `patch-glossary-entry of ${uuid} sets ${unguarded} without an expect value for it`,
        );
      }
      const mismatch = expectMismatch(entry, op.expect);
      if (mismatch) return refused(mismatch);
      const { names, definition, ...values } = op.set;
      const { save, changed } = updateSave(
        entry,
        {
          ...values,
          ...definitionChange(definition),
          ...(names ? { names: matchGlossaryNames(entry, names) } : {}),
        },
        op.expect,
      );
      planned.saves.push(save);
      planned.reports.push(
        report(uuid, changed ? 'update' : 'unchanged', entry),
      );
      continue;
    }

    if (op.op === 'relink-glossary-entry') {
      if (op.expect?.authority === undefined) {
        return refused(
          `relink-glossary-entry of ${uuid} needs expect.authority`,
        );
      }
      const mismatch = expectMismatch(entry, op.expect);
      if (mismatch) return refused(mismatch);
      const { save, changed } = updateSave(
        entry,
        { authorityUuid: op.authority },
        op.expect,
      );
      planned.saves.push(save);
      planned.reports.push(
        report(uuid, changed ? 'update' : 'unchanged', entry),
      );
      continue;
    }

    const mismatch = expectMismatch(entry, op.expect);
    if (mismatch) return refused(mismatch);
    planned.deletes.push({ uuid, expect: storedExpect(entry) });
    planned.reports.push(report(uuid, 'delete', entry));
  }
  planned.authorities = [...newAuthorities.values()];
  return planned;
};

/** Fills the reports from a save's result: the entries after it, and its names rows. */
const fillChanges = (
  changes: GlossaryChanges,
  result: Extract<GlossarySaveResult, { success: true }>,
) => {
  const after = new Map(result.entries.map((e) => [e.uuid, e]));
  for (const entry of changes.entries) {
    entry.after =
      entry.action === 'delete' ? null : (after.get(entry.uuid) ?? null);
    const rows = (action: 'copied' | 'moved') =>
      (result.nameRows ?? [])
        .filter((r) => r.entryUuid === entry.uuid && r.action === action)
        .map(({ nameUuid, language, content }) => ({
          nameUuid,
          language,
          content,
        }));
    entry.copiedNames = rows('copied');
    entry.movedNames = rows('moved');
  }
  changes.authorities = result.authorities ?? [];
  changes.rows = result.changes;
};

const failureMessage = (
  result: Extract<GlossarySaveResult, { success: false }>,
) => {
  const text =
    result.error.startsWith('Nothing was saved') ||
    result.error.startsWith('The save may have been applied')
      ? result.error
      : result.outcomeUnknown
        ? `The save may have been applied: ${result.error}`
        : `Nothing was saved: ${result.error}`;
  return result.field && !text.includes(result.field)
    ? `${text} (${result.field})`
    : text;
};

/**
 * Plans the glossary ops of one call as one save of the editor's write path
 * (`saveGlossaryEntries`): every entry, and every authority an upsert
 * creates, is written in one transaction, or none is. The plan is a dry run
 * of that save; the commit runs it for real, planned again from what is
 * stored then, and guarded by what this plan read.
 */
export const planGlossary = async ({
  client,
  workUuid,
  ops,
}: {
  client: DataClient;
  workUuid: string;
  ops: GlossaryOp[];
}): Promise<GroupPlan<GlossaryChanges>> => {
  const fail = (error: string): GroupPlan<GlossaryChanges> => ({
    ok: false,
    changes: empty(),
    warnings: [],
    error,
  });

  ops = ops.map(lowerUuids);
  workUuid = workUuid.toLowerCase();
  const uuids = ops.map((op) => entryUuidOf(workUuid, op));
  const twice = uuids.find((uuid, i) => uuids.indexOf(uuid) !== i);
  if (twice) {
    return fail(
      `Nothing was saved: entry ${twice} is named by more than one glossary op; send one op per entry`,
    );
  }

  const read = await readEntries(client, workUuid, uuids);
  if (!read.ok) return fail(`Nothing was saved: ${read.error}`);
  const stored = new Map(read.entries.map((e) => [e.uuid, e]));

  const planned = planOps(workUuid, ops, stored);
  if ('error' in planned) return fail(planned.error);

  const save = (dryRun: boolean) =>
    saveGlossaryEntries({
      client,
      workUuid,
      saves: planned.saves,
      deletes: planned.deletes,
      authorities: planned.authorities,
      dryRun,
    });

  const dry = await save(true);
  if (!dry.success) return fail(failureMessage(dry));
  const changes: GlossaryChanges = {
    ...empty(),
    entries: planned.reports,
  };
  fillChanges(changes, dry);

  const commit = async (): Promise<GroupCommit> => {
    const result = await save(false);
    if (!result.success) {
      return {
        applied: result.outcomeUnknown ? 'unknown' : false,
        warnings: [],
        error: failureMessage(result),
      };
    }
    // The report now says what was written.
    fillChanges(changes, result);
    return { applied: true, warnings: [] };
  };

  return { ok: true, changes, warnings: [], commit, extra: undefined };
};
