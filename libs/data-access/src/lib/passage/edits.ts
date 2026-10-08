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
import { readAnnotationsByPassageUuids } from './batch';
import { savePassagesWithDeletions, type NewPassageAnchor } from './save';

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
 * Compute the edited passages without touching the database.
 *
 * Every offset in `edits` is read in the coordinates of the passage as given,
 * before any edit is applied. Deletions are cut, surviving annotations are
 * re-mapped onto the shortened content, and added annotations land at the
 * mapped position of the offset supplied — so a caller describes what it wants
 * changed and never tracks what its own edits moved.
 *
 * Annotations the edits do not mention are carried through, re-mapped where a
 * deletion moved them. `droppedAnnotationUuids` lists the stored annotations
 * the edits removed or swallowed: the only ones a save may delete.
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
  /** Each inserted passage's neighbour, for the save to place it by. */
  anchors: Record<string, NewPassageAnchor>;
  droppedAnnotationUuids: string[];
  error?: string;
} => {
  const warnings: PassageEditWarning[] = [];
  const anchors: Record<string, NewPassageAnchor> = {};
  const dropped: string[] = [];
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

    for (const annotationUuid of removed) {
      if (!passage.annotations.some((a) => a.uuid === annotationUuid)) {
        warnings.push({
          passageUuid: uuid,
          message: `Did not remove annotation ${annotationUuid}: it is not on this passage, or is a type edits cannot change.`,
        });
      }
    }

    for (const annotation of passage.annotations) {
      if (removed.has(annotation.uuid)) {
        dropped.push(annotation.uuid);
        continue;
      }
      const remapped = remapAnnotation(annotation, deletions);
      if (!remapped) {
        dropped.push(annotation.uuid);
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
        // The importer's fallback id is derived, not a uuid, and would also
        // collide with an annotation removed from the same range.
        uuid: uuidv4(),
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
          anchors,
          droppedAnnotationUuids: [],
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
        anchors,
        droppedAnnotationUuids: [],
        error: `Cannot insert before ${edit.before}: no such passage.`,
      };
    }
    // Placed by the passage it goes before: several inserts in one save
    // would otherwise share this sort and tie.
    const uuid = uuidv4();
    anchors[uuid] = { before: edit.before };
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

  return {
    passages: edited,
    warnings,
    anchors,
    droppedAnnotationUuids: dropped,
  };
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

  // The draft copy, legacy rows included: this is what the save writes over.
  const annotationsRead = await readAnnotationsByPassageUuids({
    client,
    passageUuids: targetUuids,
    source: 'draft',
    includeDeprecated: true,
  });
  if ('error' in annotationsRead) {
    return {
      success: false,
      dryRun,
      passages: [],
      warnings: [],
      error: `Failed to read annotations: ${annotationsRead.error}`,
    };
  }
  const annotationsByPassage = annotationsRead.data;

  const stored = rows.map((row) =>
    passageFromDTO(
      row,
      annotationsFromDTO(
        annotationsByPassage.get(row.uuid) ?? [],
        row.content?.length ?? 0,
      ),
    ),
  );

  const {
    passages,
    warnings,
    anchors,
    droppedAnnotationUuids,
    error: editError,
  } = applyEditsToPassages({
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

  // Send only the annotations an edit added or moved, and let the save delete
  // only what an edit dropped. Everything else stays exactly as stored: the
  // DTO round-trip is not lossless, and rows written since the read survive.
  const storedByUuid = new Map(
    stored.map((passage) => [passage.uuid, passage]),
  );
  const toSave = passages.map((passage) => {
    const before = new Map(
      (storedByUuid.get(passage.uuid)?.annotations ?? []).map((a) => [
        a.uuid,
        a,
      ]),
    );
    return {
      ...passage,
      annotations: passage.annotations.filter((annotation) => {
        const original = before.get(annotation.uuid);
        return (
          !original ||
          original.start !== annotation.start ||
          original.end !== annotation.end
        );
      }),
    };
  });

  const result = await savePassagesWithDeletions({
    client,
    passages: toSave,
    anchors,
    deletableAnnotationUuids: droppedAnnotationUuids,
  });

  return {
    success: result.success,
    dryRun,
    passages,
    warnings,
    error: result.error ?? undefined,
  };
};
