import { planImportPassages } from '../import-preview';
import {
  commitPassageEdits,
  planPassageEdits,
  type PassageEdit,
} from '../passage/edits';
import { inBatches } from '../passage/in-batches';
import {
  savePassagesWithDeletions,
  type SavePassagesWithDeletionsResult,
} from '../passage/save';
import { annotationRangeFits, type DataClient } from '../types';
import type {
  GroupCommit,
  GroupPlan,
  PassageChanges,
  PassagesOp,
  UpsertPassageOp,
  WorkEditWarning,
} from './types';

/** Why a call that sends whole passages and edits together is refused. */
export const mixedPassageOpsError = (edit: string) =>
  `Nothing was saved: upsert-passage cannot be sent with ${edit} in one call. Send the whole passages and the edits as separate calls.`;

const empty = (): PassageChanges => ({ group: 'passages', passages: [] });

/** A save's outcome as a group's: a partial or lost save is `'unknown'`. */
const fromSave = (result: SavePassagesWithDeletionsResult): GroupCommit => ({
  applied: result.success
    ? true
    : result.outcomeUnknown || result.savedCount > 0
      ? 'unknown'
      : false,
  warnings: (result.warnings ?? []).map((message) => ({ message })),
  ...(result.success
    ? {}
    : { error: result.error ?? 'Failed to save passages.' }),
});

const commitSafely = async (
  save: () => Promise<SavePassagesWithDeletionsResult>,
): Promise<GroupCommit> => {
  try {
    return fromSave(await save());
  } catch (thrown) {
    return {
      applied: 'unknown',
      warnings: [],
      error: `The save may have been applied: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
    };
  }
};

/** The uuids among `uuids` that are stored. */
const storedPassageUuids = async (
  client: DataClient,
  uuids: string[],
): Promise<Set<string> | { error: string }> => {
  const stored = new Set<string>();
  for (const batch of inBatches(uuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid')
      .in('uuid', batch);
    if (error) {
      return {
        error: `Nothing was saved: failed to read stored passages: ${error.message}`,
      };
    }
    for (const row of (data ?? []) as { uuid: string }[]) stored.add(row.uuid);
  }
  return stored;
};

const planUpserts = async ({
  client,
  workUuid,
  ops,
}: {
  client: DataClient;
  workUuid: string;
  ops: UpsertPassageOp[];
}): Promise<GroupPlan<PassageChanges, null>> => {
  const changes = empty();
  let planned: Awaited<ReturnType<typeof planImportPassages>>;
  try {
    planned = await planImportPassages({
      client,
      workUuid,
      operations: ops.map(({ passage, annotations }) => ({
        kind: 'upsert_passage',
        passage,
        annotations,
      })),
    });
  } catch (thrown) {
    return {
      ok: false,
      changes,
      warnings: [],
      error: thrown instanceof Error ? thrown.message : String(thrown),
    };
  }
  const warnings: WorkEditWarning[] = planned.warnings.map((message) => ({
    message,
  }));

  // Checked here as well as by the save, so a misfit refuses the whole call
  // before an earlier group commits.
  for (const passage of planned.passages) {
    const length = passage.content.length;
    const misfit = passage.annotations.find(
      ({ start, end }) => !annotationRangeFits(start, end, length),
    );
    if (misfit) {
      return {
        ok: false,
        changes,
        warnings,
        error: `Nothing was saved: annotation ${misfit.uuid} (${misfit.type}) spans [${misfit.start}, ${misfit.end}), outside passage ${passage.uuid} of length ${length}`,
      };
    }
  }

  const stored = await storedPassageUuids(
    client,
    planned.passages.map((passage) => passage.uuid),
  );
  if ('error' in stored) {
    return { ok: false, changes, warnings, error: stored.error };
  }
  changes.passages = planned.passages.map((passage) => ({
    uuid: passage.uuid,
    label: passage.label,
    sort: passage.sort,
    action: stored.has(passage.uuid) ? 'update' : 'insert',
    annotations: passage.annotations.length,
    ...(passage.xmlId ? { xmlId: passage.xmlId } : {}),
  }));

  return {
    ok: true,
    changes,
    warnings,
    extra: null,
    // Chunked, so a large import is not all-or-nothing.
    commit: () =>
      commitSafely(() =>
        savePassagesWithDeletions({
          client,
          passages: planned.passages,
          chunked: true,
        }),
      ),
  };
};

const planEdits = async ({
  client,
  workUuid,
  ops,
}: {
  client: DataClient;
  workUuid: string;
  ops: PassageEdit[];
}): Promise<GroupPlan<PassageChanges, null>> => {
  const changes = empty();
  const plan = await planPassageEdits({ client, workUuid, edits: ops });
  if ('error' in plan) {
    return { ok: false, changes, warnings: plan.warnings, error: plan.error };
  }
  changes.passages = plan.passages.map((passage) => ({
    uuid: passage.uuid,
    label: passage.label,
    sort: passage.sort,
    action: plan.anchors[passage.uuid] ? 'insert' : 'update',
    annotations: passage.annotations.length,
    content: passage.content,
  }));
  return {
    ok: true,
    changes,
    warnings: plan.warnings,
    extra: null,
    commit: () => commitSafely(() => commitPassageEdits({ client, plan })),
  };
};

/**
 * Plans the passages group through the shared passage save path: whole
 * passages as an import writes them, or edits checked against stored
 * passages. One call holds one kind or the other.
 */
export const planPassages = async ({
  client,
  workUuid,
  ops,
}: {
  client: DataClient;
  workUuid: string;
  ops: PassagesOp[];
}): Promise<GroupPlan<PassageChanges, null>> => {
  const upserts = ops.filter(
    (op): op is UpsertPassageOp => op.op === 'upsert-passage',
  );
  const edits = ops.filter(
    (op): op is PassageEdit => op.op !== 'upsert-passage',
  );
  if (upserts.length > 0 && edits.length > 0) {
    return {
      ok: false,
      changes: empty(),
      warnings: [],
      error: mixedPassageOpsError(edits[0].op),
    };
  }
  return upserts.length > 0
    ? planUpserts({ client, workUuid, ops: upserts })
    : planEdits({ client, workUuid, ops: edits });
};
