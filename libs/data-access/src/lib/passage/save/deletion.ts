import type { DataClient } from '../../types';
import { inBatches } from '../in-batches';
import type { StepError } from './types';

const PAGE_SIZE = 1000;

/**
 * Delete rows by uuid in batches. A delete that row-level security filters
 * reports no error, so a row it did not remove is looked up again: gone
 * (another save removed it) is fine, still there is a failure.
 */
export const deleteByUuid = async (
  client: DataClient,
  table: 'passages' | 'passage_annotations',
  uuids: readonly string[],
): Promise<{ deleted: number } | { error: string }> => {
  const removed = new Set<string>();
  for (const batch of inBatches(uuids)) {
    const { data, error } = await client
      .from(table)
      .delete()
      .in('uuid', batch)
      .select('uuid');
    if (error) return { error: error.message };
    (data ?? []).forEach((row) => removed.add(row.uuid as string));
  }
  const missed = uuids.filter((uuid) => !removed.has(uuid));
  for (const batch of inBatches(missed)) {
    const { data, error } = await client
      .from(table)
      .select('uuid')
      .in('uuid', batch);
    if (error) return { error: error.message };
    if (data?.length) {
      return {
        error: `some of ${uuids.length} rows were not deleted; the delete is not permitted`,
      };
    }
  }
  return { deleted: removed.size };
};

/** The `end-note-link` annotations on any passage that point at `uuid`. */
const readEndNoteReferences = async (
  client: DataClient,
  uuid: string,
): Promise<{ data: string[] } | { error: string }> => {
  const uuids: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('passage_annotations')
      .select('uuid')
      .eq('type', 'end-note-link')
      .filter('content', 'cs', JSON.stringify([{ uuid }]))
      .order('uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { error: error.message };
    uuids.push(...(data ?? []).map((row) => row.uuid as string));
    if ((data?.length ?? 0) < PAGE_SIZE) return { data: uuids };
  }
};

/**
 * Delete passages, their annotations and the endnote links that point at
 * them.
 *
 * All annotation cleanup runs before the passage delete, so a failure aborts
 * while the passage rows still exist and a retry can redo the whole sequence.
 */
export const deletePassages = async ({
  client,
  deletedUuids,
}: {
  client: DataClient;
  /** Stored passages only. */
  deletedUuids: string[];
}): Promise<{ deletedCount: number } | StepError> => {
  if (deletedUuids.length === 0) return { deletedCount: 0 };
  // Not counted: a filtered delete leaves rows behind, and the passage
  // delete below then fails on the foreign key.
  for (const batch of inBatches(deletedUuids)) {
    const { error: deleteAnnotationsError } = await client
      .from('passage_annotations')
      .delete()
      .in('passage_uuid', batch);

    if (deleteAnnotationsError) {
      console.error(
        'Error deleting annotations for deleted passages:',
        deleteAnnotationsError,
      );
      return {
        error: `Failed to delete annotations for deleted passages: ${deleteAnnotationsError.message}`,
      };
    }
  }

  // Endnote links to a deleted note live on the passages that cite it, which
  // the delete by passage above never reaches. Left behind, they render as a
  // stray "*". A link can cite more than one deleted note.
  const references = new Set<string>();
  for (const deletedUuid of deletedUuids) {
    const found = await readEndNoteReferences(client, deletedUuid);
    if ('error' in found) {
      console.error(
        'Error finding endnote-link references to deleted passage:',
        found.error,
      );
      return {
        error: `Failed to find endnote-link references to deleted passage: ${found.error}`,
      };
    }
    found.data.forEach((uuid) => references.add(uuid));
  }
  if (references.size > 0) {
    const removed = await deleteByUuid(client, 'passage_annotations', [
      ...references,
    ]);
    if ('error' in removed) {
      console.error(
        'Error deleting endnote-link references to deleted passage:',
        removed.error,
      );
      return {
        error: `Failed to delete endnote-link references to deleted passage: ${removed.error}`,
      };
    }
  }

  const removed = await deleteByUuid(client, 'passages', deletedUuids);
  if ('error' in removed) {
    console.error('Error deleting passages:', removed.error);
    return { error: `Failed to delete passages: ${removed.error}` };
  }

  return { deletedCount: deletedUuids.length };
};
