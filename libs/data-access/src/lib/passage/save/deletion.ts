import type { DataClient } from '../../types';
import type { AnnotationWriteRow, StepError } from './types';

const PAGE_SIZE = 1000;

/**
 * The stored `end-note-link` annotations, on any passage, that point at one
 * of the given passages. Endnote links to a deleted note live on the
 * passages that cite it, which deleting the note's own annotations never
 * reaches; left behind, they render as a stray "*".
 */
export const readEndNoteReferences = async (
  client: DataClient,
  passageUuids: readonly string[],
): Promise<{ data: string[] } | StepError> => {
  const uuids = new Set<string>();
  for (const uuid of passageUuids) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from('passage_annotations')
        .select('uuid')
        .eq('type', 'end-note-link')
        .filter('content', 'cs', JSON.stringify([{ uuid }]))
        .order('uuid', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.error(
          'Error finding endnote links to deleted passages:',
          error,
        );
        return {
          error: `Failed to find endnote links to deleted passages: ${error.message}`,
        };
      }
      (data ?? []).forEach((row) => uuids.add(row.uuid as string));
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return { data: [...uuids] };
};

const citesAny = (row: AnnotationWriteRow, deleted: Set<string>) =>
  row.type === 'end-note-link' &&
  row.content.some((entry) =>
    deleted.has((entry as { uuid?: string })?.uuid ?? ''),
  );

/**
 * The endnote links a save removes because they cite a deleted passage, by
 * the content they will have once saved: a link this save sends is judged by
 * what it sends, so one retargeted away from the deleted note is kept and one
 * newly pointed at it goes. A link that goes is not written.
 */
export const planEndNoteCleanup = ({
  storedReferences,
  sent,
  upserts,
  stored,
  deletedPassageUuids,
}: {
  /** Stored links that cite a deleted passage. */
  storedReferences: readonly string[];
  /** Every annotation the save sends, written or unchanged. */
  sent: AnnotationWriteRow[];
  upserts: AnnotationWriteRow[];
  /** Uuids of the stored annotations of the saved passages. */
  stored: Set<string>;
  deletedPassageUuids: readonly string[];
}): { upserts: AnnotationWriteRow[]; deletes: string[] } => {
  const deleted = new Set(deletedPassageUuids);
  if (deleted.size === 0) return { upserts, deletes: [] };
  const sentByUuid = new Map(sent.map((row) => [row.uuid, row]));
  const goes = new Set([
    ...storedReferences.filter((uuid) => {
      const row = sentByUuid.get(uuid);
      return !row || citesAny(row, deleted);
    }),
    ...sent.filter((row) => citesAny(row, deleted)).map((row) => row.uuid),
  ]);
  const storedReferenceSet = new Set(storedReferences);
  return {
    upserts: upserts.filter((row) => !goes.has(row.uuid)),
    deletes: [...goes].filter(
      (uuid) => storedReferenceSet.has(uuid) || stored.has(uuid),
    ),
  };
};
