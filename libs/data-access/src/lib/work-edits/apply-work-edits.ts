import type { DataClient } from '../types';
import { mixedPassageOpsError, planPassages } from './passages';
import {
  WORK_EDIT_GROUPS,
  type ApplyWorkEditsResult,
  type GroupPlan,
  type PassageChanges,
  type PassagesOp,
  type WorkEditGroup,
  type WorkEditGroupResult,
  type WorkEditOp,
  type WorkMetadataChanges,
  type WorkMetadataOp,
} from './types';
import { planWorkMetadata } from './work-metadata';

type AnyPlan = GroupPlan<WorkMetadataChanges | PassageChanges>;

const GROUP_OF: Record<WorkEditOp['op'], WorkEditGroup> = {
  'update-work': 'work-metadata',
  'upsert-title': 'work-metadata',
  'upsert-folio-annotation': 'work-metadata',
  'upsert-passage': 'passages',
  'insert-passage': 'passages',
  'delete-text': 'passages',
  'add-annotation': 'passages',
  'remove-annotation': 'passages',
};

/** The group an op commits in. */
export const workEditGroupOf = (op: WorkEditOp): WorkEditGroup =>
  GROUP_OF[op.op];

const planGroup = (
  group: WorkEditGroup,
  args: { client: DataClient; workUuid: string; ops: WorkEditOp[] },
): Promise<AnyPlan> => {
  switch (group) {
    case 'work-metadata':
      return planWorkMetadata({ ...args, ops: args.ops as WorkMetadataOp[] });
    case 'passages':
      return planPassages({ ...args, ops: args.ops as PassagesOp[] });
  }
};

/**
 * Applies ops to everything one work owns. Ops fall into groups, each with
 * its own write path. Every group is planned against stored state before
 * anything is written, so a refused guard or check writes nothing; then the
 * groups commit one at a time in a fixed order, and the first that fails
 * stops the call. `dryRun` returns the plans without writing. Never throws
 * for a refused or failed write: the result says what was written.
 */
export const applyWorkEdits = async ({
  client,
  workUuid,
  ops,
  dryRun = false,
}: {
  client: DataClient;
  workUuid: string;
  ops: WorkEditOp[];
  dryRun?: boolean;
}): Promise<ApplyWorkEditsResult> => {
  const byGroup = new Map<WorkEditGroup, WorkEditOp[]>();
  for (const op of ops) {
    const group = GROUP_OF[op.op];
    if (!group) {
      return {
        success: false,
        dryRun,
        groups: [],
        notAttempted: [],
        error: `Nothing was saved: unknown op ${JSON.stringify((op as { op: unknown }).op)}`,
      };
    }
    byGroup.set(group, [...(byGroup.get(group) ?? []), op]);
  }
  const groups = WORK_EDIT_GROUPS.filter((group) => byGroup.has(group));

  const passageOps = byGroup.get('passages') ?? [];
  const upsert = passageOps.find((op) => op.op === 'upsert-passage');
  const edit = passageOps.find((op) => op.op !== 'upsert-passage');
  if (upsert && edit) {
    return {
      success: false,
      dryRun,
      groups: [],
      notAttempted: groups,
      error: mixedPassageOpsError(edit.op),
    };
  }

  // Plan every group before writing any.
  const plans: [WorkEditGroup, AnyPlan][] = [];
  for (const group of groups) {
    const plan = await planGroup(group, {
      client,
      workUuid,
      ops: byGroup.get(group) ?? [],
    });
    if (!plan.ok) {
      return {
        success: false,
        dryRun,
        groups: [
          {
            group,
            applied: false,
            ops: byGroup.get(group)?.length ?? 0,
            changes: plan.changes,
            warnings: plan.warnings,
            error: plan.error,
          },
        ],
        notAttempted: groups.filter((other) => other !== group),
        error: plan.error,
      };
    }
    plans.push([group, plan]);
  }

  const results: WorkEditGroupResult[] = plans.map(([group, plan]) => ({
    group,
    applied: false,
    ops: byGroup.get(group)?.length ?? 0,
    changes: plan.changes,
    warnings: [...plan.warnings],
  }));
  if (dryRun) {
    return { success: true, dryRun, groups: results, notAttempted: [] };
  }

  for (const [at, [, plan]] of plans.entries()) {
    if (!plan.ok) continue;
    const committed = await plan.commit();
    const result = results[at];
    result.applied = committed.applied;
    result.warnings.push(...committed.warnings);
    if (committed.applied !== true) {
      result.error = committed.error ?? 'The write failed.';
      return {
        success: false,
        dryRun,
        groups: results.slice(0, at + 1),
        notAttempted: plans.slice(at + 1).map(([group]) => group),
        error: result.error,
      };
    }
  }
  return { success: true, dryRun, groups: results, notAttempted: [] };
};
