import {
  ANNOTATIONS_TO_IGNORE,
  BodyItemType,
  DataClient,
  Passage,
  TohokuCatalogEntry,
  passagesToDTO,
  passagesToRowDTO,
} from '../../types';
import { deletePassages } from './deletion';
import {
  annotationHasChanged,
  passageRowHasChanged,
  type ExistingAnnotationRow,
  type ExistingPassageRow,
} from './diff';
import { normalizePassageLabelsAfter } from './labels';
import { makeRoomForNewPassages, sortsAfterShift } from './placement';
import {
  failure,
  type RenumberedPassageRow,
  type SavePassagesWithDeletionsResult,
  type SavedPassageRow,
} from './types';

/**
 * Persists edited passages and their annotations, and removes deleted
 * passages.
 *
 * supabase-js provides no transactions, so this runs as a sequence of
 * independent writes ordered to keep the partial-failure window small: sort
 * shifts, then core content upserts, then cosmetic label renumbering, then
 * deletions (labels renumbered only after the delete succeeds), then orphaned
 * annotation cleanup. Every write is an idempotent upsert/delete keyed by
 * uuid, so any failure reported to the client converges when the client
 * retries the same save.
 */
export const savePassagesWithDeletions = async ({
  client,
  passages,
  deletedUuids = [],
  insertAfter,
}: {
  client: DataClient;
  passages: Passage[];
  deletedUuids?: string[];
  /**
   * For each new passage, the uuid of the saved passage it follows, or null
   * when it opens its work. When given for every new passage, the save places
   * them by it and assigns their sorts; see `placeNewPassages`.
   */
  insertAfter?: Record<string, string | null>;
}): Promise<SavePassagesWithDeletionsResult> => {
  const inputUuids = passages.map((p) => p.uuid);
  const { data: existingRows } =
    inputUuids.length > 0
      ? await client
          .from('passages')
          .select(
            'uuid, content, label, sort, type, work_uuid, xmlId, parent, toh',
          )
          .in('uuid', inputUuids)
      : { data: [] };
  const existingUuidSet = new Set((existingRows ?? []).map((r) => r.uuid));
  const newPassages = passages.filter((p) => !existingUuidSet.has(p.uuid));

  // Make room for new passages before their rows are inserted; a sort
  // collision here would corrupt ordering, so abort on failure.
  const room = await makeRoomForNewPassages({
    client,
    newPassages,
    insertAfter,
  });
  if ('error' in room) {
    return failure(room.error);
  }
  const { placedSorts } = room;

  const sorted = await sortsAfterShift({
    client,
    passages,
    existingRows: (existingRows ?? []) as ExistingPassageRow[],
    placedSorts,
    shifted: newPassages.length > 0,
  });
  if ('error' in sorted) {
    return failure(sorted.error);
  }
  const { toSave, shiftedSorts } = sorted;

  // Compute row/annotation diffs against the pre-save state before any
  // content writes happen.
  const dtos = passagesToDTO(toSave);
  const passageRowDtos = passagesToRowDTO(toSave);
  const passageUuids = passages.map((p) => p.uuid);
  const annotations = dtos.flatMap((p) => p.annotations || []);
  const { data: existingAnnotations } =
    passageUuids.length > 0
      ? await client
          .from('passage_annotations')
          .select('uuid, passage_uuid, start, end, type, content, toh')
          .in('passage_uuid', passageUuids)
          .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`)
      : { data: [] };

  const existingRowsByUuid = new Map(
    ((existingRows ?? []) as ExistingPassageRow[]).map((row) => [
      row.uuid,
      { ...row, sort: shiftedSorts.get(row.uuid) ?? row.sort },
    ]),
  );
  const passageRowsToUpsert = passageRowDtos.filter((row) =>
    passageRowHasChanged(row, existingRowsByUuid.get(row.uuid)),
  );
  const existingAnnotationsByUuid = new Map(
    ((existingAnnotations ?? []) as ExistingAnnotationRow[]).map(
      (annotation) => [annotation.uuid, annotation],
    ),
  );
  const annotationsToUpsert = annotations.filter((annotation) =>
    annotationHasChanged(
      annotation,
      existingAnnotationsByUuid.get(annotation.uuid),
    ),
  );

  // A passage whose annotation set is incomplete (serialization gap on the
  // client) must not have its stored annotations treated as deletions —
  // deleting them would turn a transient export failure into permanent data
  // loss. They are cleaned up by the next complete export.
  const incompletePassageUuids = new Set(
    passages
      .filter((passage) => passage.annotationsIncomplete)
      .map((passage) => passage.uuid),
  );
  const annotationsToDelete = existingAnnotations?.filter(
    (existingAnnotation) =>
      !incompletePassageUuids.has(existingAnnotation.passage_uuid) &&
      !annotations.find(
        (annotation) => annotation.uuid === existingAnnotation.uuid,
      ),
  );

  // Core content commits first — everything after this point is cosmetic
  // renumbering or cleanup.
  if (passageRowsToUpsert.length > 0) {
    const { error: passageError } = await client
      .from('passages')
      .upsert(passageRowsToUpsert, { onConflict: 'uuid' });

    if (passageError) {
      console.error('Error saving passages:', passageError);
      return failure(`Failed to save passages: ${passageError.message}`);
    }
  }

  if (annotationsToUpsert.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotationsToUpsert, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving annotations:', annotationError);
      return failure(
        `Passages saved but annotations failed: ${annotationError.message}`,
        passages.length,
      );
    }
  }

  // Renumber neighbors of inserted passages now that the content is safe.
  const renumberedByUuid = new Map<string, string>();
  const clientRenumberedUuids = new Set(inputUuids);
  const placedSort = (passage: Passage) =>
    placedSorts.get(passage.uuid) ?? passage.sort;
  const renumberOrder = [...newPassages].sort(
    (a, b) => placedSort(b) - placedSort(a),
  );
  for (const passage of renumberOrder) {
    const { error, renumbered } = await normalizePassageLabelsAfter({
      client,
      workUuid: passage.workUuid,
      fromSort: placedSort(passage),
      fromLabel: passage.label,
      delta: 1,
      clientRenumberedUuids,
    });
    renumbered.forEach((row) => renumberedByUuid.set(row.uuid, row.label));
    if (error) {
      return failure(
        `Content saved but passage labels were not renumbered: ${error}`,
        passages.length,
      );
    }
  }

  let deletedCount = 0;
  if (deletedUuids.length > 0) {
    const deleted = await deletePassages({
      client,
      deletedUuids,
      clientRenumberedUuids,
    });
    if ('error' in deleted) {
      return failure(deleted.error, passages.length);
    }
    deletedCount = deleted.deletedCount;
    deleted.renumbered.forEach((row) =>
      renumberedByUuid.set(row.uuid, row.label),
    );
  }

  // Stale rows left behind here resurrect deleted markup on the next load,
  // so a failure must reach the client even though the content upserts
  // already committed.
  if (annotationsToDelete && annotationsToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('passage_annotations')
      .delete()
      .in(
        'uuid',
        annotationsToDelete.map((annotation) => annotation.uuid),
      );

    if (deleteError) {
      console.error('Error deleting annotations:', deleteError);
      return failure(
        `Passages saved but stale annotations could not be removed: ${deleteError.message}`,
        passages.length,
      );
    }
  }

  const { data: savedRows } =
    inputUuids.length > 0
      ? await client
          .from('passages')
          .select('uuid, work_uuid, content, label, sort, type, xmlId, toh')
          .in('uuid', inputUuids)
      : { data: [] };

  const savedPassages: SavedPassageRow[] = (savedRows ?? []).map((row) => ({
    uuid: row.uuid,
    workUuid: row.work_uuid,
    content: row.content,
    label: row.label ?? '',
    sort: row.sort,
    type: row.type as BodyItemType,
    xmlId: row.xmlId ?? null,
    toh: (row.toh as TohokuCatalogEntry) ?? null,
  }));

  // Rows returned in `passages` already carry their final label, so reporting
  // them again as renumbered would be redundant.
  const savedUuidSet = new Set(savedPassages.map((row) => row.uuid));
  const renumberedPassages: RenumberedPassageRow[] = Array.from(
    renumberedByUuid.entries(),
  )
    .filter(([uuid]) => !savedUuidSet.has(uuid))
    .map(([uuid, label]) => ({ uuid, label }));

  return {
    success: true,
    savedCount: passages.length,
    deletedCount,
    passages: savedPassages,
    renumberedPassages,
  };
};
