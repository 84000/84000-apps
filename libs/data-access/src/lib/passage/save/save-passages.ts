import {
  ANNOTATIONS_TO_IGNORE,
  AnnotationDTO,
  BodyItemType,
  DataClient,
  Passage,
  TohokuCatalogEntry,
  passagesToDTO,
  passagesToRowDTO,
} from '../../types';
import { deletePassages } from './deletion';
import { annotationHasChanged, passageRowHasChanged } from './diff';
import { normalizePassageLabelsAfter } from './labels';
import { makeRoomForNewPassages, sortsAfterShift } from './placement';
import { inBatches } from '../in-batches';
import {
  readDeletedPassages,
  readExistingAnnotations,
  readExistingPassages,
  type DeletedPassageRow,
} from './reads';
import {
  failure,
  type NewPassageAnchor,
  type RenumberedPassageRow,
  type SavePassagesWithDeletionsResult,
  type SavedPassageRow,
} from './types';
import { validateSave } from './validate';

/**
 * Persists edited passages and their annotations, and removes deleted
 * passages.
 *
 * The input is validated and every row the save depends on is read before
 * anything is written, so a failure up to that point saved nothing. Writes
 * then run as a sequence ordered to keep the partial-failure window small:
 * sort shifts, then core content upserts, then cosmetic label renumbering,
 * then deletions (labels renumbered only after the delete succeeds), then
 * orphaned annotation cleanup. Every write is an idempotent upsert/delete
 * keyed by uuid, so any failure reported to the client converges when the
 * client retries the same save.
 */
export const savePassagesWithDeletions = async ({
  client,
  passages: inputPassages,
  deletedUuids: inputDeletedUuids = [],
  anchors,
  deletableAnnotationUuids,
  annotationRows: inputAnnotationRows = [],
}: {
  client: DataClient;
  passages: Passage[];
  deletedUuids?: string[];
  /**
   * For each new passage, the saved passage it sits next to. When given for
   * every new passage, the save places them by it and assigns their sorts;
   * see `placeNewPassages`.
   */
  anchors?: Record<string, NewPassageAnchor>;
  /**
   * When given, only these stored annotations may be deleted; any other
   * annotation absent from the payload is left as stored. For a caller that
   * sends only the annotations it changed.
   */
  deletableAnnotationUuids?: readonly string[];
  /**
   * Annotation rows to write as given, alongside the passages' own
   * annotations, bypassing domain serialization.
   */
  annotationRows?: AnnotationDTO[];
}): Promise<SavePassagesWithDeletionsResult> => {
  const valid = validateSave({
    passages: inputPassages,
    deletedUuids: inputDeletedUuids,
    annotationRows: inputAnnotationRows,
  });
  if ('error' in valid) {
    return failure(valid.error);
  }
  const { passages, deletedUuids, annotationRows } = valid;
  const inputUuids = passages.map((p) => p.uuid);

  const notSaved = (error: string) => failure(`${error}; nothing was saved`);
  const existingRead = await readExistingPassages(client, inputUuids);
  if ('error' in existingRead) {
    return notSaved(existingRead.error);
  }
  const existingRows = existingRead.data;
  const existingUuidSet = new Set(existingRows.map((r) => r.uuid));
  const newPassages = passages.filter((p) => !existingUuidSet.has(p.uuid));

  // New passages have no stored annotations. Types editors never load are
  // left out: they are never sent, so must not read as deleted.
  const annotationsRead = await readExistingAnnotations(client, [
    ...existingUuidSet,
  ]);
  if ('error' in annotationsRead) {
    return notSaved(annotationsRead.error);
  }
  const existingAnnotations = annotationsRead.data.filter(
    (row) => !ANNOTATIONS_TO_IGNORE.includes(row.type),
  );

  let deletedPassages: DeletedPassageRow[] = [];
  if (deletedUuids.length > 0) {
    const deletedRead = await readDeletedPassages(client, deletedUuids);
    if ('error' in deletedRead) {
      return notSaved(deletedRead.error);
    }
    deletedPassages = deletedRead.data;
  }

  // Make room for new passages before their rows are inserted; a sort
  // collision here would corrupt ordering, so abort on failure.
  const room = await makeRoomForNewPassages({
    client,
    newPassages,
    anchors,
  });
  if ('error' in room) {
    return failure(room.error);
  }
  const { placedSorts } = room;

  const sorted = await sortsAfterShift({
    client,
    passages,
    existingRows,
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
  const annotations = [
    ...dtos.flatMap((p) => p.annotations || []),
    ...annotationRows,
  ];
  const existingRowsByUuid = new Map(
    existingRows.map((row) => [
      row.uuid,
      { ...row, sort: shiftedSorts.get(row.uuid) ?? row.sort },
    ]),
  );
  const passageRowsToUpsert = passageRowDtos.filter((row) =>
    passageRowHasChanged(row, existingRowsByUuid.get(row.uuid)),
  );
  const existingAnnotationsByUuid = new Map(
    existingAnnotations.map((annotation) => [annotation.uuid, annotation]),
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
  const deletable = deletableAnnotationUuids
    ? new Set(deletableAnnotationUuids)
    : undefined;
  const annotationsToDelete = existingAnnotations.filter(
    (existingAnnotation) =>
      !incompletePassageUuids.has(existingAnnotation.passage_uuid) &&
      (!deletable || deletable.has(existingAnnotation.uuid)) &&
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
    // An unlabelled passage (the MCP inserts them) is in no numbered series,
    // and there is no number to count on from.
    if (!passage.label) continue;
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

  // Inserting shifted and relabelled the passages to delete since they were
  // read; renumbering after them starts from where they are now.
  if (newPassages.length > 0 && deletedPassages.length > 0) {
    const reread = await readDeletedPassages(
      client,
      deletedPassages.map((row) => row.uuid),
    );
    if ('error' in reread) {
      return failure(
        `Content saved but passages were not deleted: ${reread.error}`,
        passages.length,
      );
    }
    deletedPassages = reread.data;
  }

  let deletedCount = 0;
  if (deletedPassages.length > 0) {
    const deleted = await deletePassages({
      client,
      deletedPassages,
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
  for (const batch of inBatches(
    annotationsToDelete.map((annotation) => annotation.uuid),
  )) {
    const { error: deleteError } = await client
      .from('passage_annotations')
      .delete()
      .in('uuid', batch);

    if (deleteError) {
      console.error('Error deleting annotations:', deleteError);
      return failure(
        `Passages saved but stale annotations could not be removed: ${deleteError.message}`,
        passages.length,
      );
    }
  }

  // The content is saved by now: a failed read-back is a warning.
  const warnings: string[] = [];
  const savedPassages: SavedPassageRow[] = [];
  for (const batch of inBatches(inputUuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, work_uuid, content, label, sort, type, xmlId, toh')
      .in('uuid', batch);
    if (error) {
      console.error('Error reading saved passages:', error);
      warnings.push(
        `Saved, but the saved passages could not be read back: ${error.message}`,
      );
      savedPassages.length = 0;
      break;
    }
    (data ?? []).forEach((row) =>
      savedPassages.push({
        uuid: row.uuid,
        workUuid: row.work_uuid,
        content: row.content,
        label: row.label ?? '',
        sort: row.sort,
        type: row.type as BodyItemType,
        xmlId: row.xmlId ?? null,
        toh: (row.toh as TohokuCatalogEntry) ?? null,
      }),
    );
  }

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
    ...(warnings.length ? { warnings } : {}),
  };
};
