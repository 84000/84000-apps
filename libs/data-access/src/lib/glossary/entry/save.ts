import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import { rolledBack } from '../../passage/save/commit';
import { checkInput, planSave, sameNames, type PlannedSave } from './plan';
import { countCitingAnnotations, readStored } from './stored';
import {
  glossaryEntryFromDTO,
  type GlossaryEntry,
  type GlossaryEntryChange,
  type GlossaryEntryDelete,
  type GlossaryEntryExpect,
  type GlossaryEntryNameInput,
  type GlossaryEntrySave,
  type GlossarySaveChanges,
  type GlossarySaveFailure,
  type GlossarySaveResult,
  type GlossarySaveResultDTO,
} from './types';

export { storedGlossaryDefinition } from './plan';

const NO_CHANGES: GlossarySaveChanges = {
  glossaries: { inserted: 0, updated: 0, deleted: 0 },
  glossaryEdges: { inserted: 0, deleted: 0 },
  names: { inserted: 0, updated: 0 },
  annotations: { deleted: 0 },
};

/** Plans made and applied before a save that keeps meeting newer data is stale. */
const ATTEMPTS = 3;

const failure = (
  reason: GlossarySaveFailure,
  error: string,
  outcomeUnknown = false,
  field?: string,
): GlossarySaveResult => ({
  success: false,
  reason,
  error,
  ...(field ? { field } : {}),
  outcomeUnknown,
});

type ApplyError = { message: string; code?: string };

type Applied =
  | { status: 'applied'; dto: GlossarySaveResultDTO }
  | { status: 'stale'; error: ApplyError }
  | { status: 'failed'; result: GlossarySaveResult };

const apply = async (
  client: DataClient,
  workUuid: string,
  { plan }: PlannedSave,
): Promise<Applied> => {
  let answer: { data: unknown; error: ApplyError | null };
  try {
    answer = await client.rpc('apply_glossary_save', {
      p_work_uuid: workUuid,
      ...plan,
    });
  } catch (thrown) {
    // Sent, but with no answer to say whether it committed.
    answer = {
      data: null,
      error: {
        message: thrown instanceof Error ? thrown.message : String(thrown),
      },
    };
  }

  const { error } = answer;
  if (error) {
    if (error.code === 'PT409') return { status: 'stale', error };
    console.error('Error saving glossary entries:', error);
    if (error.code === '42501') {
      return { status: 'failed', result: failure('forbidden', error.message) };
    }
    const unknown = !rolledBack(error.code);
    return {
      status: 'failed',
      result: failure(
        'failed',
        `${unknown ? 'The save may have been applied' : 'Nothing was saved'}: ${error.message}`,
        unknown,
      ),
    };
  }
  const dto = answer.data as GlossarySaveResultDTO | null;
  if (!Array.isArray(dto?.entries) || !dto?.changes) {
    console.error('Unexpected glossary save result:', answer.data);
    return {
      status: 'failed',
      result: failure(
        'failed',
        'The database answered, but not with a save result',
        true,
      ),
    };
  }
  return { status: 'applied', dto };
};

const resultFromDTO = (dto: GlossarySaveResultDTO): GlossarySaveResult => ({
  success: true,
  dryRun: false,
  entries: dto.entries.map(glossaryEntryFromDTO),
  deleted: dto.deleted,
  changes: {
    glossaries: dto.changes.glossaries,
    glossaryEdges: dto.changes.glossary_edges,
    names: dto.changes.names,
    annotations: dto.changes.annotations,
  },
});

/** A dry run's result: the plan's entries and counts, nothing applied. */
const dryRunResult = async (
  client: DataClient,
  workUuid: string,
  planned: PlannedSave,
): Promise<GlossarySaveResult> => {
  const rows = planned.plan.p_entry_deletes.flatMap((d) => d.rows);
  let annotations: number;
  try {
    annotations = await countCitingAnnotations(client, workUuid, rows);
  } catch (thrown) {
    console.error('Error counting glossary instances:', thrown);
    return failure(
      'failed',
      `Nothing was saved: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
    );
  }
  return {
    success: true,
    dryRun: true,
    entries: planned.entries,
    deleted: planned.deleted,
    changes: { ...planned.changes, annotations: { deleted: annotations } },
  };
};

/**
 * Saves, creates and deletes glossary entries of one work in a single
 * transaction: when any part is refused, nothing is written. A written
 * definition is sanitized first. With no saves and no deletes, or nothing to
 * change, nothing is written.
 *
 * Input is checked here; the database applies the planned rows only if what
 * they were planned from is unchanged, and the save is planned again from
 * newer data a few times before it is refused as stale.
 */
export const saveGlossaryEntries = async ({
  client,
  workUuid,
  saves,
  deletes = [],
  dryRun = false,
}: {
  client: DataClient;
  workUuid: string;
  saves: readonly GlossaryEntrySave[];
  deletes?: readonly GlossaryEntryDelete[];
  dryRun?: boolean;
}): Promise<GlossarySaveResult> => {
  if (saves.length === 0 && deletes.length === 0) {
    return {
      success: true,
      dryRun,
      entries: [],
      deleted: [],
      changes: NO_CHANGES,
    };
  }
  const fault = checkInput(saves, deletes);
  if (fault) return failure(fault.reason, fault.error, false, fault.field);

  let lastStale = '';
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const read = await readStored(client, workUuid, saves, deletes);
    if (!read.ok) return failure('failed', `Nothing was saved: ${read.error}`);
    const planned = planSave(workUuid, saves, deletes, read.stored);
    if ('reason' in planned) {
      return failure(planned.reason, planned.error, false, planned.field);
    }
    if (!planned.writes) {
      return {
        success: true,
        dryRun,
        entries: saves.map(
          ({ uuid }) => read.stored.entries.get(uuid) as GlossaryEntry,
        ),
        deleted: [],
        changes: NO_CHANGES,
      };
    }
    if (dryRun) return dryRunResult(client, workUuid, planned);

    const applied = await apply(client, workUuid, planned);
    if (applied.status === 'applied') return resultFromDTO(applied.dto);
    if (applied.status === 'failed') return applied.result;
    lastStale = applied.error.message;
  }
  return failure(
    'stale',
    `The entries kept changing while saving them: ${lastStale}`,
  );
};

const sameNullable = (a: string | null | undefined, b: string | null) =>
  (a ?? null) === b;

/**
 * The change and expect for turning `before` (as read) into `after`: each
 * field of `after` that differs from `before` goes into `change`, with
 * `before`'s value in `expect`. Names are compared as a set.
 */
export const glossaryEntryChange = (
  before: GlossaryEntry,
  after: GlossaryEntryChange,
): { change: GlossaryEntryChange; expect: GlossaryEntryExpect } => {
  const change: GlossaryEntryChange = {};
  const expect: GlossaryEntryExpect = {};
  if (
    after.authorityUuid !== undefined &&
    after.authorityUuid !== before.authorityUuid
  ) {
    change.authorityUuid = after.authorityUuid;
    expect.authorityUuid = before.authorityUuid;
  }
  if (
    after.definition !== undefined &&
    !sameNullable(after.definition, before.definition)
  ) {
    change.definition = after.definition;
    expect.definition = before.definition;
  }
  if (
    after.definitionRend !== undefined &&
    !sameNullable(after.definitionRend, before.definitionRend)
  ) {
    change.definitionRend = after.definitionRend;
    expect.definitionRend = before.definitionRend;
  }
  if (
    after.glossMode !== undefined &&
    (after.glossMode ?? 'match') !== (before.glossMode ?? 'match')
  ) {
    change.glossMode = after.glossMode;
    expect.glossMode = before.glossMode;
  }
  if (after.names !== undefined && !sameNames(after.names, before.names)) {
    change.names = [...after.names];
    expect.names = [...before.names];
  }
  return { change, expect };
};

/**
 * Saves one entry from its read state: only what differs from `before` is
 * written, guarded by `before`'s values.
 */
export const saveGlossaryEntry = async ({
  client,
  workUuid,
  before,
  after,
  dryRun,
}: {
  client: DataClient;
  workUuid: string;
  before: GlossaryEntry;
  after: GlossaryEntryChange;
  dryRun?: boolean;
}): Promise<GlossarySaveResult> =>
  saveGlossaryEntries({
    client,
    workUuid,
    saves: [{ uuid: before.uuid, ...glossaryEntryChange(before, after) }],
    dryRun,
  });

/** Creates one entry, its first name as the root; `uuid` is generated when absent. */
export const createGlossaryEntry = async ({
  client,
  workUuid,
  entry: { uuid = uuidv4(), ...change },
  dryRun,
}: {
  client: DataClient;
  workUuid: string;
  entry: {
    uuid?: string;
    authorityUuid: string;
    definition?: string | null;
    definitionRend?: string | null;
    glossMode?: string | null;
    names: GlossaryEntryNameInput[];
  };
  dryRun?: boolean;
}): Promise<GlossarySaveResult> =>
  saveGlossaryEntries({
    client,
    workUuid,
    saves: [{ uuid, create: true, change }],
    dryRun,
  });

/**
 * Deletes one entry: every row and edge of it, and the glossary instances
 * citing it in this work. Names and authorities stay.
 */
export const deleteGlossaryEntry = async ({
  client,
  workUuid,
  uuid,
  expect,
  dryRun,
}: {
  client: DataClient;
  workUuid: string;
  uuid: string;
  expect?: GlossaryEntryExpect;
  dryRun?: boolean;
}): Promise<GlossarySaveResult> =>
  saveGlossaryEntries({
    client,
    workUuid,
    saves: [],
    deletes: [{ uuid, expect }],
    dryRun,
  });
