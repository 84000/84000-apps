import { readEntries } from '../glossary/entry/stored';
import {
  glossaryEntryChange,
  saveGlossaryEntries,
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
  GlossarySaveChanges,
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

const NO_ROWS: GlossarySaveChanges = {
  glossaries: { inserted: 0, updated: 0, deleted: 0 },
  glossaryEdges: { inserted: 0, deleted: 0 },
  names: { inserted: 0, updated: 0 },
  annotations: { deleted: 0 },
};

const empty = (): GlossaryChanges => ({
  group: 'glossary',
  entries: [],
  authorities: [],
  rows: NO_ROWS,
});

type Refusal = { error: string };

const refused = (error: string): Refusal => ({
  error: `Nothing was saved: ${error}`,
});

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

/** Whether `expected` lists every stored name once, matching the fields it gives. */
const sameNames = (
  expected: NonNullable<GlossaryExpect['names']>,
  stored: readonly GlossaryEntryName[],
) => {
  if (expected.length !== stored.length) return false;
  const left = [...stored];
  return expected.every((want) => {
    const at = left.findIndex((name) =>
      Object.entries(want).every(
        ([key, value]) =>
          value === undefined ||
          same(name[key as keyof GlossaryEntryName], value),
      ),
    );
    if (at < 0) return false;
    left.splice(at, 1);
    return true;
  });
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
  contentTransformed:
    name.contentTransformed !== undefined
      ? name.contentTransformed
      : (was?.contentTransformed ?? null),
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

/** What an upsert asks the entry to be, as a save's change. */
const upsertChange = (
  op: UpsertGlossaryEntryOp,
  authorityUuid: string,
  entry: GlossaryEntry | undefined,
): GlossaryEntryChange => {
  const { definition, definitionRend, glossMode, names } = op.entry;
  return {
    authorityUuid,
    ...(definition !== undefined ? { definition } : {}),
    ...(definitionRend !== undefined ? { definitionRend } : {}),
    ...(glossMode !== undefined ? { glossMode } : {}),
    names: matchGlossaryNames(entry, names),
  };
};

/** A save of a stored entry: only what differs, guarded by the stored values. */
const updateSave = (
  entry: GlossaryEntry,
  after: GlossaryEntryChange,
): { save: GlossaryEntrySave; changed: boolean } => {
  const { change, expect } = glossaryEntryChange(entry, after);
  return {
    save: { uuid: entry.uuid, change, expect },
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
    const stale = (message: string) => refused(message);

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
      if (mismatch) return stale(mismatch);
      const { save, changed } = updateSave(
        entry,
        upsertChange(op, authorityUuid, entry),
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
      if (mismatch) return stale(mismatch);
      const { names, ...values } = op.set;
      const { save, changed } = updateSave(entry, {
        ...values,
        ...(names ? { names: matchGlossaryNames(entry, names) } : {}),
      });
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
      if (mismatch) return stale(mismatch);
      const { save, changed } = updateSave(entry, {
        authorityUuid: op.authority,
      });
      planned.saves.push(save);
      planned.reports.push(
        report(uuid, changed ? 'update' : 'unchanged', entry),
      );
      continue;
    }

    const mismatch = expectMismatch(entry, op.expect);
    if (mismatch) return stale(mismatch);
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
    const names = new Map(
      (entry.before?.names ?? []).map((n) => [n.nameUuid, n]),
    );
    const rows = (action: 'copied' | 'moved') =>
      (result.nameRows ?? [])
        .filter((r) => r.entryUuid === entry.uuid && r.action === action)
        .map((r) => {
          const name = names.get(r.nameUuid);
          return {
            nameUuid: r.nameUuid,
            language: name?.language ?? null,
            content: name?.content ?? '',
          };
        });
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
