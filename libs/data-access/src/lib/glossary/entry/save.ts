import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import { rolledBack } from '../../passage/save/commit';
import {
  checkInput,
  ENTRY_FIELDS,
  planSave,
  unchangedField,
  type PlanFailure,
  type PlannedSave,
} from './plan';
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

const message = (thrown: unknown) =>
  thrown instanceof Error ? thrown.message : String(thrown);

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
      error: { message: message(thrown) },
    };
  }

  const { error } = answer;
  if (error) {
    // Refused as stale, or a create that lost a race for its uuid (23505):
    // rolled back, and a new read says which.
    if (error.code === 'PT409' || error.code === '23505') {
      return { status: 'stale', error };
    }
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
        'The save was applied, but its result could not be read',
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
    return failure('failed', `Nothing was saved: ${message(thrown)}`);
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
 *
 * A dry run plans without applying. Its names are sorted like the read's,
 * but by this runtime's collation, so punctuation may order differently.
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
    if (!read.ok && read.retry) {
      lastStale = read.error;
      continue;
    }
    if (!read.ok) return failure('failed', `Nothing was saved: ${read.error}`);
    let planned: PlannedSave | PlanFailure;
    try {
      planned = planSave(workUuid, saves, deletes, read.stored);
    } catch (thrown) {
      console.error('Error planning glossary save:', thrown);
      return failure('failed', `Nothing was saved: ${message(thrown)}`);
    }
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

/**
 * The change and expect for turning `before` (as read) into `after`: each
 * field of `after` that differs from `before` goes into `change`, with
 * `before`'s value in `expect`. Names are compared as a set.
 */
export const glossaryEntryChange = (
  before: GlossaryEntry,
  after: GlossaryEntryChange,
): { change: GlossaryEntryChange; expect: GlossaryEntryExpect } => {
  const change: Record<string, unknown> = {};
  const expect: Record<string, unknown> = {};
  const copy = (value: unknown) => (Array.isArray(value) ? [...value] : value);
  for (const key of ENTRY_FIELDS) {
    if (unchangedField(key, after[key], before)) continue;
    change[key] = copy(after[key]);
    expect[key] = copy(before[key]);
  }
  return {
    change: change as GlossaryEntryChange,
    expect: expect as GlossaryEntryExpect,
  };
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
