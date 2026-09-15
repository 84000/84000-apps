import { v4 as uuidv4 } from 'uuid';
import {
  type Annotation,
  type Annotations,
  type BodyItemType,
  type DataClient,
  type Passage,
  type PassageDTO,
  annotationFromImport,
  annotationsFromDTO,
  passageFromDTO,
} from '../types';
import { getAnnotationsByPassageUuids } from './batch';
import { savePassagesWithDeletions } from './save';

/** Remove a span of text from a passage. Offsets are in the stored content. */
export type DeleteTextEdit = {
  op: 'delete-text';
  passageUuid: string;
  start: number;
  end: number;
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
  passageUuid: string;
  message: string;
};

export type ApplyPassageEditsResult = {
  success: boolean;
  dryRun: boolean;
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

/** Cut every deletion out of `content`, working right to left. */
const applyDeletions = (content: string, deletions: Deletion[]): string =>
  [...deletions]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end }) => text.slice(0, start) + text.slice(end),
      content,
    );

/**
 * Re-map an annotation onto the edited content. Returns null when the
 * annotation is swallowed by a deletion: a range that collapses to nothing
 * marked text that no longer exists, and keeping it as a zero-length
 * annotation would silently change what it means.
 */
const remapAnnotation = (
  annotation: Annotation,
  deletions: Deletion[],
): Annotation | null => {
  const start = mapOffset(annotation.start, deletions);
  const end = mapOffset(annotation.end, deletions);

  if (annotation.start !== annotation.end && start === end) {
    return null;
  }

  return { ...annotation, start, end };
};

const isPassageEditFor = (edit: PassageEdit, uuid: string) =>
  edit.op !== 'insert-passage' && edit.passageUuid === uuid;

/**
 * Apply a set of edits to the passages they name and persist the result.
 *
 * Every offset in `edits` is read in the coordinates of the **stored** content,
 * before any edit is applied. Deletions are cut, the surviving annotations are
 * re-mapped onto the shortened content, and added annotations land at the
 * mapped position of the offset given — so a caller describes what it wants
 * changed and never has to track what its own edits moved.
 *
 * Annotations the edits do not mention are carried through untouched, which is
 * what makes this safe on a passage that already has content: the save path
 * deletes annotations absent from the payload.
 */
/**
 * Compute the edited passages without touching the database.
 *
 * Every offset in `edits` is read in the coordinates of the passage as given,
 * before any edit is applied. Deletions are cut, surviving annotations are
 * re-mapped onto the shortened content, and added annotations land at the
 * mapped position of the offset supplied — so a caller describes what it wants
 * changed and never tracks what its own edits moved.
 *
 * Annotations the edits do not mention are carried through untouched. That is
 * what makes this safe on a passage that already has content: the save path
 * deletes annotations absent from the payload.
 */
export const applyEditsToPassages = ({
  workUuid,
  passages,
  edits,
}: {
  workUuid: string;
  passages: Passage[];
  edits: PassageEdit[];
}): {
  passages: Passage[];
  warnings: PassageEditWarning[];
  error?: string;
} => {
  const warnings: PassageEditWarning[] = [];
  const stored = new Map(passages.map((passage) => [passage.uuid, passage]));
  const edited: Passage[] = [];

  for (const [uuid, passage] of stored) {
    const forPassage = edits.filter((edit) => isPassageEditFor(edit, uuid));
    if (forPassage.length === 0) {
      continue;
    }

    const deletions = forPassage
      .filter((edit): edit is DeleteTextEdit => edit.op === 'delete-text')
      .map(({ start, end }) => ({ start, end }));

    const removed = new Set(
      forPassage
        .filter(
          (edit): edit is RemoveAnnotationEdit =>
            edit.op === 'remove-annotation',
        )
        .map((edit) => edit.annotationUuid),
    );

    const content = applyDeletions(passage.content, deletions);
    const kept: Annotations = [];

    for (const annotation of passage.annotations) {
      if (removed.has(annotation.uuid)) {
        continue;
      }
      const remapped = remapAnnotation(annotation, deletions);
      if (!remapped) {
        warnings.push({
          passageUuid: uuid,
          message: `Dropped ${annotation.type} annotation ${annotation.uuid}: the text it marked was deleted.`,
        });
        continue;
      }
      kept.push(remapped);
    }

    for (const edit of forPassage) {
      if (edit.op !== 'add-annotation') {
        continue;
      }
      const annotation = annotationFromImport(edit.kind, {
        start: mapOffset(edit.start, deletions),
        end: mapOffset(edit.end ?? edit.start, deletions),
        passageUuid: uuid,
        passageText: content,
        data: edit.data,
      });

      if (!annotation) {
        return {
          passages: [],
          warnings,
          error: `Cannot build a "${edit.kind}" annotation for passage ${uuid}. The kind has no importer, or required data is missing.`,
        };
      }

      kept.push(annotation);
    }

    edited.push({ ...passage, content, annotations: kept });
  }

  for (const edit of edits) {
    if (edit.op !== 'insert-passage') {
      continue;
    }
    const anchor = stored.get(edit.before);
    if (!anchor) {
      return {
        passages: [],
        warnings,
        error: `Cannot insert before ${edit.before}: no such passage.`,
      };
    }
    // The save path shifts the run beginning at this sort to open the slot.
    edited.push({
      uuid: uuidv4(),
      workUuid,
      content: edit.content,
      label: edit.label ?? '',
      sort: anchor.sort,
      type: (edit.type ?? anchor.type) as BodyItemType,
      toh: anchor.toh,
      annotations: [],
    });
  }

  return { passages: edited, warnings };
};

/**
 * Read the passages an edit set names, apply the edits, and persist the result.
 * `dryRun` returns what would be written without writing it.
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
  const targetUuids = [
    ...new Set(
      edits.flatMap((edit) =>
        edit.op === 'insert-passage' ? [edit.before] : [edit.passageUuid],
      ),
    ),
  ];

  const { data, error } = await client
    .from('passages')
    .select('uuid, content, label, sort, type, work_uuid, xmlId, parent, toh')
    .eq('work_uuid', workUuid)
    .in('uuid', targetUuids);

  if (error) {
    return {
      success: false,
      dryRun,
      passages: [],
      warnings: [],
      error: `Failed to read passages: ${error.message}`,
    };
  }

  const rows = (data ?? []) as PassageDTO[];
  const missing = targetUuids.filter(
    (uuid) => !rows.some((row) => row.uuid === uuid),
  );
  if (missing.length > 0) {
    return {
      success: false,
      dryRun,
      passages: [],
      warnings: [],
      error: `Not in work ${workUuid}: ${missing.join(', ')}`,
    };
  }

  const annotationsByPassage = await getAnnotationsByPassageUuids({
    client,
    passageUuids: targetUuids,
  });

  const stored = rows.map((row) =>
    passageFromDTO(
      row,
      annotationsFromDTO(
        annotationsByPassage.get(row.uuid) ?? [],
        row.content?.length ?? 0,
      ),
    ),
  );

  const { passages, warnings, error: editError } = applyEditsToPassages({
    workUuid,
    passages: stored,
    edits,
  });

  if (editError) {
    return { success: false, dryRun, passages: [], warnings, error: editError };
  }

  if (dryRun) {
    return { success: true, dryRun, passages, warnings };
  }

  const result = await savePassagesWithDeletions({ client, passages });

  return {
    success: result.success,
    dryRun,
    passages,
    warnings,
    error: result.error ?? undefined,
  };
};
