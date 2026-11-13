import { NO_CHANGES, saveGlossaryEntries } from '../glossary/entry/save';
import { readEntries } from '../glossary/entry/stored';
import type { GlossarySaveResult } from '../glossary/entry/types';
import type { DataClient } from '../types';
import { planOps } from './glossary-ops';
import { entryUuidOf, lowerUuids } from './glossary-uuids';
import type {
  GlossaryChanges,
  GlossaryOp,
  GroupCommit,
  GroupPlan,
} from './types';

const empty = (): GlossaryChanges => ({
  group: 'glossary',
  entries: [],
  authorities: [],
  rows: NO_CHANGES,
});

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
