import type { AnnotationDTO, DataClient } from '../../types';
import { IN_BATCH_SIZE, readAnnotationsByPassageUuids } from '../batch';
import type { ExistingAnnotationRow, ExistingPassageRow } from './diff';
import type { StepError } from './types';

/** The values of an `in` filter, in batches small enough for the URL. */
export const inBatches = <T>(values: readonly T[]): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < values.length; i += IN_BATCH_SIZE) {
    batches.push(values.slice(i, i + IN_BATCH_SIZE));
  }
  return batches;
};

/** A stored passage about to be deleted: what renumbering needs of it. */
export type DeletedPassageRow = {
  uuid: string;
  sort: number;
  label: string;
  work_uuid: string;
};

/**
 * The stored rows of the given passages. A batch of uuids returns at most
 * that many rows, so no batch reaches PostgREST's 1000-row cap.
 */
export const readExistingPassages = async (
  client: DataClient,
  uuids: readonly string[],
): Promise<{ data: ExistingPassageRow[] } | StepError> => {
  const rows: ExistingPassageRow[] = [];
  for (const batch of inBatches(uuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, content, label, sort, type, work_uuid, xmlId, parent, toh')
      .in('uuid', batch);
    if (error) {
      console.error('Error reading stored passages:', error);
      return { error: `Failed to read stored passages: ${error.message}` };
    }
    rows.push(...((data ?? []) as ExistingPassageRow[]));
  }
  return { data: rows };
};

/** The stored rows of the passages a save deletes; missing ones are skipped. */
export const readDeletedPassages = async (
  client: DataClient,
  uuids: readonly string[],
): Promise<{ data: DeletedPassageRow[] } | StepError> => {
  const rows: DeletedPassageRow[] = [];
  for (const batch of inBatches(uuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, sort, label, work_uuid')
      .in('uuid', batch);
    if (error) {
      console.error('Error reading passages marked for deletion:', error);
      return {
        error: `Failed to read passages marked for deletion: ${error.message}`,
      };
    }
    rows.push(...((data ?? []) as DeletedPassageRow[]));
  }
  return { data: rows };
};

/**
 * Every stored annotation on the given passages, of every type, legacy and
 * draft-only rows included: the rows the save writes over. Batched and paged
 * by `readAnnotationsByPassageUuids`.
 */
export const readExistingAnnotations = async (
  client: DataClient,
  passageUuids: readonly string[],
): Promise<{ data: ExistingAnnotationRow[] } | StepError> => {
  const read = await readAnnotationsByPassageUuids({
    client,
    passageUuids,
    source: 'draft',
    includeDeprecated: true,
  });
  if ('error' in read) {
    console.error('Error reading stored annotations:', read.error);
    return { error: `Failed to read stored annotations: ${read.error}` };
  }
  return {
    data: [...read.data.values()].flat().map((row: AnnotationDTO) => ({
      ...row,
      passage_uuid: row.passage_uuid ?? '',
    })),
  };
};
