import {
  AnnotationDTO,
  BodyItemType,
  DataClient,
  Passage,
  TohokuCatalogEntry,
  passagesToRowDTO,
} from '../../types';
import { commitSave } from './commit';
import { planEndNoteCleanup, readEndNoteReferences } from './deletion';
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
  type SavePassagesWithDeletionsResult,
  type SavedPassageRow,
} from './types';
import { validateSave } from './validate';

/**
 * Persists edited passages and their annotations, and removes deleted
 * passages.
 *
 * The input is validated, every row the save depends on is read, and every
 * write is planned, labels and endnote cleanup included, before anything is
 * written. Room is then made for new passages (sort shifts, which only open
 * gaps), and the rest is committed in one transaction by
 * `apply_passage_save`: all of it lands, or none of it. A large save without
 * passage deletions, such as an import, is committed in chunks, and a failure
 * leaves the chunks before it written; see `commitSave`.
 *
 * A failure that may have been applied, because the commit's response was
 * lost, sets `outcomeUnknown`. Every write is an upsert or delete keyed by
 * uuid, so a retry of the same save converges.
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
  keepAnnotationUuids: inputKeepAnnotationUuids,
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
  /**
   * Stored annotations to leave exactly as stored: not deleted, moved or
   * checked. For rows a caller could not load, such as ones out of range.
   */
  keepAnnotationUuids?: readonly string[];
}): Promise<SavePassagesWithDeletionsResult> => {
  const valid = validateSave({
    passages: inputPassages,
    deletedUuids: inputDeletedUuids,
    annotationRows: inputAnnotationRows,
    keepAnnotationUuids: inputKeepAnnotationUuids,
  });
  if ('error' in valid) {
    return failure(valid.error);
  }
  const { passages, deletedUuids, annotationRows, keepAnnotationUuids } = valid;
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
  const deletedPassageUuids = deletedPassages.map((row) => row.uuid);
  const references = await readEndNoteReferences(client, deletedPassageUuids);
  if ('error' in references) {
    return notSaved(references.error);
  }

  const storedContent = new Map(
    existingRows.map((row) => [row.uuid, row.content]),
  );
  const {
    upserts: plannedUpserts,
    unchanged: annotationsUnchanged,
    deletes: staleAnnotations,
    warnings: planWarnings,
  } = planAnnotations({
    passages,
    annotationRows,
    existing: annotationsRead.data,
    storedContent,
    keep: keepAnnotationUuids,
    deletable: deletableAnnotationUuids,
  });
  const endNotes = planEndNoteCleanup({
    storedReferences: references.data,
    sent: [...plannedUpserts, ...annotationsUnchanged],
    upserts: plannedUpserts,
    stored: new Set(annotationsRead.data.map((row) => row.uuid)),
    deletedPassageUuids,
  });
  const annotationsToUpsert = endNotes.upserts;
  const annotationsToDelete = [
    ...new Set([...staleAnnotations, ...endNotes.deletes]),
  ];
  const outOfRange = findOutOfRange({
    upserts: annotationsToUpsert,
    unchanged: annotationsUnchanged,
    contentByPassage: new Map(passages.map((p) => [p.uuid, p.content])),
    storedContentByPassage: storedContent,
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

  const plannedLabels = await planSaveLabels({
    client,
    toSave: sorted.toSave,
    newUuids: new Set(newPassages.map((p) => p.uuid)),
    deleted: deletedPassages,
  });
  if ('error' in plannedLabels) {
    return failure(plannedLabels.error);
  }
  const labels = plannedLabels.data.final;
  const toSave = sorted.toSave.map((passage) => {
    const label = labels.get(passage.uuid);
    return label === undefined ? passage : { ...passage, label };
  });
  const payloadUuids = new Set(inputUuids);

  const committed = await commitSave(client, {
    passages: planPassages(
      passagesToRowDTO(toSave),
      new Map(
        existingRows.map((row) => [
          row.uuid,
          { ...row, sort: shiftedSorts.get(row.uuid) ?? row.sort },
        ]),
      ),
    ),
    // Saved passages carry theirs.
    labels: [...labels]
      .filter(([uuid]) => !payloadUuids.has(uuid))
      .map(([uuid, label]) => ({ uuid, label })),
    annotations: annotationsToUpsert,
    deleteAnnotations: annotationsToDelete,
    deletePassages: deletedPassageUuids,
  });
  if ('error' in committed) {
    return {
      ...failure(committed.error, committed.savedPassages),
      ...(committed.outcomeUnknown ? { outcomeUnknown: true } : {}),
    };
  }
  const deletedCount = deletedPassageUuids.length;

  const warnings = [...planWarnings];
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
  const renumberedPassages = [...labels]
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
