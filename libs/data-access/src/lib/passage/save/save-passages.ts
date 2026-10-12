import {
  AnnotationDTO,
  BodyItemType,
  DataClient,
  Passage,
  TohokuCatalogEntry,
  passagesToRowDTO,
} from '../../types';
import { deleteByUuid, deletePassages } from './deletion';
import { planSaveLabels } from './labels';
import { makeRoomForNewPassages, sortsAfterShift } from './placement';
import { findOutOfRange, planAnnotations, planPassages } from './plan';
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
 * sort shifts, content upserts, stale annotation deletes, passage deletions,
 * then the labels of other passages that inserting or deleting renumbered,
 * which are planned before any write. Every write is an idempotent upsert or
 * delete keyed by uuid, so a retry of the same save converges.
 *
 * A save places new passages but never moves an existing one: a changed
 * `sort` on an existing passage is ignored, and moving one needs an explicit
 * move operation.
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

  // New passages have no stored annotations.
  const annotationsRead = await readExistingAnnotations(client, [
    ...existingUuidSet,
  ]);
  if ('error' in annotationsRead) {
    return notSaved(annotationsRead.error);
  }

  let deletedPassages: DeletedPassageRow[] = [];
  if (deletedUuids.length > 0) {
    const deletedRead = await readDeletedPassages(client, deletedUuids);
    if ('error' in deletedRead) {
      return notSaved(deletedRead.error);
    }
    deletedPassages = deletedRead.data;
  }

  const {
    upserts: annotationsToUpsert,
    unchanged: annotationsUnchanged,
    deletes: annotationsToDelete,
  } = planAnnotations({
    passages,
    annotationRows,
    existing: annotationsRead.data,
    deletable: deletableAnnotationUuids,
  });
  const outOfRange = findOutOfRange({
    upserts: annotationsToUpsert,
    unchanged: annotationsUnchanged,
    contentByPassage: new Map(passages.map((p) => [p.uuid, p.content])),
    storedContentByPassage: new Map(
      existingRows.map((row) => [row.uuid, row.content]),
    ),
  });
  if (outOfRange) {
    return failure(`Invalid save, nothing was saved: ${outOfRange}`);
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
  const { shiftedSorts } = sorted;

  // Planned in full before anything is written: payload passages take their
  // new labels with their content, the rest are written after it.
  const plannedLabels = await planSaveLabels({
    client,
    toSave: sorted.toSave,
    newUuids: new Set(newPassages.map((p) => p.uuid)),
    deleted: deletedPassages,
  });
  if ('error' in plannedLabels) {
    return failure(plannedLabels.error);
  }
  const toSave = sorted.toSave.map((passage) => {
    const label = plannedLabels.data.get(passage.uuid);
    return label === undefined ? passage : { ...passage, label };
  });
  const payloadUuids = new Set(inputUuids);
  const labelRows: RenumberedPassageRow[] = [...plannedLabels.data]
    .filter(([uuid]) => !payloadUuids.has(uuid))
    .map(([uuid, label]) => ({ uuid, label }));

  const passageRowsToUpsert = planPassages(
    passagesToRowDTO(toSave),
    new Map(
      existingRows.map((row) => [
        row.uuid,
        { ...row, sort: shiftedSorts.get(row.uuid) ?? row.sort },
      ]),
    ),
  );

  // Core content commits first — everything after this point is renumbering
  // or cleanup.
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

  // Stale rows left behind here resurrect deleted markup on the next load,
  // so a failure must reach the client even though the content upserts
  // already committed. Before the passage deletes, whose endnote cleanup
  // could otherwise remove some of these first.
  if (annotationsToDelete.length > 0) {
    const removed = await deleteByUuid(
      client,
      'passage_annotations',
      annotationsToDelete,
    );
    if ('error' in removed) {
      console.error('Error deleting annotations:', removed.error);
      return failure(
        `Passages saved but stale annotations could not be removed: ${removed.error}`,
        passages.length,
      );
    }
  }

  let deletedCount = 0;
  if (deletedPassages.length > 0) {
    const deleted = await deletePassages({
      client,
      deletedUuids: deletedPassages.map((row) => row.uuid),
    });
    if ('error' in deleted) {
      return failure(deleted.error, passages.length);
    }
    deletedCount = deleted.deletedCount;
  }

  if (labelRows.length > 0) {
    const { error: labelError } = await client
      .from('passages')
      .upsert(labelRows, { onConflict: 'uuid' });
    if (labelError) {
      console.error('Error renumbering passage labels:', labelError);
      return failure(
        `Content saved but passage labels were not renumbered: ${labelError.message}`,
        passages.length,
      );
    }
  }

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
  const renumberedPassages = labelRows.filter(
    (row) => !savedUuidSet.has(row.uuid),
  );

  return {
    success: true,
    savedCount: passages.length,
    deletedCount,
    passages: savedPassages,
    renumberedPassages,
    ...(warnings.length ? { warnings } : {}),
  };
};
