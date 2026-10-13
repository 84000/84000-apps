import { v4 as uuidv4 } from 'uuid';
import {
  type AnnotationDTO,
  type BodyItemType,
  type DataClient,
  type Passage,
  type PassageDTO,
  annotationFromDTO,
  annotationFromImport,
  annotationRangeFits,
  annotationToDTO,
  annotationsFromDTO,
  passageFromDTO,
} from '../types';
import { readAnnotationsByPassageUuids } from './batch';
import { savePassagesWithDeletions, type NewPassageAnchor } from './save';
import { stableStringify } from './save/diff';
import { inBatches } from './in-batches';

/**
 * Remove a span of text from a passage. Offsets are in the stored content,
 * and `text` is exactly what they cover: an edit whose text is not there is
 * refused, which catches most cuts sent twice, though not all.
 */
export type DeleteTextEdit = {
  op: 'delete-text';
  passageUuid: string;
  start: number;
  end: number;
  text: string;
};

/** Add an annotation. `end` defaults to `start`, giving a zero-length marker. */
export type AddAnnotationEdit = {
  op: 'add-annotation';
  passageUuid: string;
  kind: string;
  start: number;
  end?: number;
  data?: Record<string, unknown>;
};

/** Remove an annotation by its uuid. */
export type RemoveAnnotationEdit = {
  op: 'remove-annotation';
  passageUuid: string;
  annotationUuid: string;
};

/** Insert a passage immediately before an existing one. */
export type InsertPassageEdit = {
  op: 'insert-passage';
  before: string;
  content: string;
  label?: string;
  type?: string;
};

export type PassageEdit =
  | DeleteTextEdit
  | AddAnnotationEdit
  | RemoveAnnotationEdit
  | InsertPassageEdit;

export type PassageEditWarning = {
  /** Absent for a warning about the save as a whole. */
  passageUuid?: string;
  message: string;
};

export type ApplyPassageEditsResult = {
  success: boolean;
  dryRun: boolean;
  /**
   * Whether the edits were written. `'unknown'` when the save's response was
   * lost: re-read the passages before issuing anything again.
   */
  applied: boolean | 'unknown';
  passages: Passage[];
  warnings: PassageEditWarning[];
  error?: string;
};

type Deletion = { start: number; end: number };

/**
 * Map an offset in the original content to its position after `deletions` are
 * removed. A position inside a deleted span collapses to that span's start.
 */
const mapOffset = (offset: number, deletions: Deletion[]): number => {
  let mapped = offset;
  for (const { start, end } of deletions) {
    if (offset >= end) {
      mapped -= end - start;
    } else if (offset > start) {
      mapped -= offset - start;
    }
  }
  return mapped;
};

/**
 * Sort the cuts and merge overlapping or repeated ones into their union, so
 * each character is removed and counted once. Returns an error message for a
 * range that is reversed or outside the content.
 */
const mergeDeletions = (
  deletions: Deletion[],
  length: number,
): Deletion[] | string => {
  const invalid = deletions.find(
    ({ start, end }) =>
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end > length,
  );
  if (invalid) {
    return `Cannot delete ${invalid.start}–${invalid.end}: the range must be ordered and within the passage (length ${length}).`;
  }

  const merged: Deletion[] = [];
  for (const cut of [...deletions].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && cut.start <= last.end) {
      last.end = Math.max(last.end, cut.end);
    } else {
      merged.push({ ...cut });
    }
  }
  return merged;
};

/** Cut every deletion out of `content`, working right to left. */
const applyDeletions = (content: string, deletions: Deletion[]): string =>
  [...deletions]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end }) => text.slice(0, start) + text.slice(end),
      content,
    );

/** A row's content as its domain type would write it back. */
const normalizedContent = (row: AnnotationDTO, length: number) => {
  const dto = annotationToDTO(annotationFromDTO(row, length)) ?? row;
  return stableStringify([dto.content ?? [], dto.toh ?? null]);
};

/**
 * The row in `rows` that `row` duplicates: the same type and range, and the
 * same content once both are normalized, so rows written by older importers
 * with other key sets still match.
 */
const duplicateOf = (
  rows: AnnotationDTO[],
  row: AnnotationDTO,
  length: number,
) =>
  rows.find(
    (other) =>
      other.type === row.type &&
      other.start === row.start &&
      other.end === row.end &&
      normalizedContent(other, length) === normalizedContent(row, length),
  );

const isPassageEditFor = (edit: PassageEdit, uuid: string) =>
  edit.op !== 'insert-passage' && edit.passageUuid === uuid;

/**
 * Compute the edited passages without touching the database.
 *
 * Every offset in `edits` is read in the coordinates of the passage as given,
 * before any edit is applied. Deletions are cut, the stored annotation rows
 * of every type are moved onto the shortened content, and added annotations
 * land at the mapped position of the offset supplied, so a caller describes
 * what it wants changed and never tracks what its own edits moved.
 *
 * Returns each edited passage's full annotation state as stored rows, written
 * back verbatim apart from their offsets, and the same as domain annotations
 * for display.
 */
export const applyEditsToPassages = ({
  workUuid,
  passages,
  annotations,
  edits,
}: {
  workUuid: string;
  passages: Passage[];
  /** Every stored annotation row of each passage, by passage uuid. */
  annotations: Map<string, AnnotationDTO[]>;
  edits: PassageEdit[];
}): {
  passages: Passage[];
  rawAnnotations: Record<string, AnnotationDTO[]>;
  warnings: PassageEditWarning[];
  /** Each inserted passage's neighbour, for the save to place it by. */
  anchors: Record<string, NewPassageAnchor>;
  error?: string;
} => {
  const warnings: PassageEditWarning[] = [];
  const anchors: Record<string, NewPassageAnchor> = {};
  const rawAnnotations: Record<string, AnnotationDTO[]> = {};
  const stored = new Map(passages.map((passage) => [passage.uuid, passage]));
  const edited: Passage[] = [];
  const fail = (error: string) => ({
    passages: [],
    rawAnnotations: {},
    warnings,
    anchors,
    error,
  });

  for (const [uuid, passage] of stored) {
    const forPassage = edits.filter((edit) => isPassageEditFor(edit, uuid));
    if (forPassage.length === 0) {
      continue;
    }

    const cuts = forPassage.filter(
      (edit): edit is DeleteTextEdit => edit.op === 'delete-text',
    );
    const deletions = mergeDeletions(
      cuts.map(({ start, end }) => ({ start, end })),
      passage.content.length,
    );
    if (typeof deletions === 'string') {
      return fail(`Passage ${uuid}: ${deletions}`);
    }
    const misread = cuts.find(
      (cut) => passage.content.slice(cut.start, cut.end) !== cut.text,
    );
    if (misread) {
      const found = passage.content.slice(misread.start, misread.end);
      return fail(
        `Passage ${uuid}: expected ${JSON.stringify(misread.text)} at ${misread.start}–${misread.end} but found ${JSON.stringify(found)}. If this edit was already applied, re-read the passage.`,
      );
    }

    const removed = new Set(
      forPassage
        .filter(
          (edit): edit is RemoveAnnotationEdit =>
            edit.op === 'remove-annotation',
        )
        .map((edit) => edit.annotationUuid),
    );

    const content = applyDeletions(passage.content, deletions);
    const storedRows = annotations.get(uuid) ?? [];
    const rows: AnnotationDTO[] = [];

    for (const annotationUuid of removed) {
      if (!storedRows.some((row) => row.uuid === annotationUuid)) {
        warnings.push({
          passageUuid: uuid,
          message: `Did not remove annotation ${annotationUuid}: it is not on this passage.`,
        });
      }
    }

    for (const row of storedRows) {
      if (removed.has(row.uuid)) {
        continue;
      }
      // A stored row already out of range cannot be moved meaningfully; it
      // is carried as stored.
      if (
        deletions.length > 0 &&
        !annotationRangeFits(row.start, row.end, passage.content.length)
      ) {
        rows.push(row);
        warnings.push({
          passageUuid: uuid,
          message: `Left ${row.type} annotation ${row.uuid} as stored: its range [${row.start}, ${row.end}) was already outside the passage.`,
        });
        continue;
      }
      const start = mapOffset(row.start, deletions);
      const end = mapOffset(row.end, deletions);
      // A range that collapses marked text that no longer exists; keeping it
      // as a zero-length annotation would change what it means.
      if (row.start !== row.end && start === end) {
        warnings.push({
          passageUuid: uuid,
          message: `Dropped ${row.type} annotation ${row.uuid}: the text it marked was deleted.`,
        });
        continue;
      }
      rows.push({ ...row, start, end });
    }

    for (const edit of forPassage) {
      if (edit.op !== 'add-annotation') {
        continue;
      }
      const annotation = annotationFromImport(edit.kind, {
        // The importer's fallback id is derived, not a uuid, and would also
        // collide with an annotation removed from the same range.
        uuid: uuidv4(),
        start: mapOffset(edit.start, deletions),
        end: mapOffset(edit.end ?? edit.start, deletions),
        passageUuid: uuid,
        passageText: content,
        data: edit.data,
      });
      const row = annotation && annotationToDTO(annotation);
      if (!row) {
        return fail(
          `Cannot build a "${edit.kind}" annotation for passage ${uuid}. The kind has no importer, or required data is missing.`,
        );
      }
      const existing = duplicateOf(rows, row, content.length);
      if (existing) {
        warnings.push({
          passageUuid: uuid,
          message: `Skipped add-annotation: identical ${edit.kind} ${existing.uuid} already at ${row.start}–${row.end}.`,
        });
        continue;
      }
      rows.push({ ...row, passage_uuid: uuid });
    }

    rawAnnotations[uuid] = rows;
    edited.push({
      ...passage,
      content,
      annotations: annotationsFromDTO(rows, content.length),
    });
  }

  for (const edit of edits) {
    if (edit.op !== 'insert-passage') {
      continue;
    }
    const anchor = stored.get(edit.before);
    if (!anchor) {
      return fail(`Cannot insert before ${edit.before}: no such passage.`);
    }
    // Placed by the passage it goes before: several inserts in one save
    // would otherwise share this sort and tie.
    const uuid = uuidv4();
    anchors[uuid] = { before: edit.before };
    rawAnnotations[uuid] = [];
    edited.push({
      uuid,
      workUuid,
      content: edit.content,
      label: edit.label ?? '',
      sort: anchor.sort,
      type: (edit.type ?? anchor.type) as BodyItemType,
      toh: anchor.toh,
      annotations: [],
    });
  }

  return { passages: edited, rawAnnotations, warnings, anchors };
};

/**
 * Read the passages an edit set names, apply the edits, and persist the result
 * in one commit. `dryRun` returns what would be written without writing it.
 * Never retries: after `applied: 'unknown'`, the caller re-reads first.
 */
export const applyPassageEdits = async ({
  client,
  workUuid,
  edits,
  dryRun = false,
}: {
  client: DataClient;
  workUuid: string;
  edits: PassageEdit[];
  dryRun?: boolean;
}): Promise<ApplyPassageEditsResult> => {
  const failed = (
    error: string,
    warnings: PassageEditWarning[] = [],
  ): ApplyPassageEditsResult => ({
    success: false,
    dryRun,
    applied: false,
    passages: [],
    warnings,
    error,
  });
  const targetUuids = [
    ...new Set(
      edits.flatMap((edit) =>
        edit.op === 'insert-passage' ? [edit.before] : [edit.passageUuid],
      ),
    ),
  ];

  const rows: PassageDTO[] = [];
  for (const batch of inBatches(targetUuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, content, label, sort, type, work_uuid, xmlId, parent, toh')
      .eq('work_uuid', workUuid)
      .in('uuid', batch);

    if (error) {
      return failed(`Failed to read passages: ${error.message}`);
    }
    rows.push(...((data ?? []) as PassageDTO[]));
  }
  const missing = targetUuids.filter(
    (uuid) => !rows.some((row) => row.uuid === uuid),
  );
  if (missing.length > 0) {
    return failed(`Not in work ${workUuid}: ${missing.join(', ')}`);
  }

  // Every row of every type in the draft copy: the full state the save
  // writes, so a row left out of it is one an edit removed.
  const annotationsRead = await readAnnotationsByPassageUuids({
    client,
    passageUuids: targetUuids,
    source: 'draft',
    includeDeprecated: true,
  });
  if ('error' in annotationsRead) {
    return failed(`Failed to read annotations: ${annotationsRead.error}`);
  }

  const {
    passages,
    rawAnnotations,
    warnings,
    anchors,
    error: editError,
  } = applyEditsToPassages({
    workUuid,
    passages: rows.map((row) => passageFromDTO(row, [])),
    annotations: annotationsRead.data,
    edits,
  });

  if (editError) {
    return failed(editError, warnings);
  }

  if (dryRun) {
    return { success: true, dryRun, applied: false, passages, warnings };
  }

  const result = await savePassagesWithDeletions({
    client,
    passages: passages.map((passage) => ({ ...passage, annotations: [] })),
    anchors,
    rawAnnotations,
  });
  (result.warnings ?? []).forEach((message) => warnings.push({ message }));

  return {
    success: result.success,
    dryRun,
    applied: result.success ? true : result.outcomeUnknown ? 'unknown' : false,
    passages,
    warnings,
    error: result.error ?? undefined,
  };
};
