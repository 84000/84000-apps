import {
  ANNOTATIONS_TO_IGNORE,
  BodyItemType,
  DataClient,
  AnnotationDTO,
  Passage,
  PassageRowDTO,
  TohokuCatalogEntry,
  passagesToDTO,
  passagesToRowDTO,
} from '../types';

const SAVE_PAGE_SIZE = 500;

export const savePassages = async ({
  client,
  passages,
}: {
  client: DataClient;
  passages: Passage[];
}) => {
  /**
   * 1. Extract all annotations from savePassages
   * 2. Query the database for all current annotations for the savePassages
   * 3. Determine which annotations need to be deleted or upserted
   * 4. Upsert the passages
   * 5. Upsert the annotations
   * 6. Delete the annotations that are no longer present
   */
  const dtos = passagesToDTO(passages);
  const passageRowDtos = passagesToRowDTO(passages);
  const passageUuids = passages.map((p) => p.uuid);
  const annotations = dtos.flatMap((p) => p.annotations || []);

  const { data: existingAnnotations } = await client
    .from('passage_annotations')
    .select(`uuid`)
    .in('passage_uuid', passageUuids)
    .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

  const annotationsToDelete = existingAnnotations?.filter(
    (ea) => !annotations.find((a) => a.uuid === ea.uuid),
  );

  const { error: passageError } = await client
    .from('passages')
    .upsert(passageRowDtos, { onConflict: 'uuid' });

  if (passageError) {
    console.error('Error saving passages:', passageError);
    return;
  }

  if (annotations.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotations, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving annotations:', annotationError);
      throw annotationError;
    }
  }

  if (annotationsToDelete && annotationsToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('passage_annotations')
      .delete()
      .in(
        'uuid',
        annotationsToDelete.map((a) => a.uuid),
      );

    if (deleteError) {
      console.error('Error deleting annotations:', deleteError);
      throw deleteError;
    }
  }
};

async function normalizePassageLabelsAfter({
  client,
  workUuid,
  fromSort,
  fromLabel,
  delta,
}: {
  client: DataClient;
  workUuid: string;
  fromSort: number;
  fromLabel: string;
  delta: number;
}): Promise<void> {
  const parts = fromLabel.split('.');
  const depth = parts.length;
  const prefix = depth > 1 ? `${parts.slice(0, -1).join('.')}.` : '';
  let nextInt = Number.parseInt(parts[depth - 1], 10) + Math.max(delta, 0);
  let lastSort = fromSort;
  let done = false;

  while (!done) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, label, sort')
      .eq('work_uuid', workUuid)
      .gt('sort', lastSort)
      .order('sort', { ascending: true })
      .limit(SAVE_PAGE_SIZE);

    if (error || !data || data.length === 0) break;

    const labelUpdates: { uuid: string; label: string }[] = [];
    const prefixRenames: { oldPrefix: string; newPrefix: string }[] = [];

    for (const row of data) {
      const rowParts = (row.label ?? '').split('.');

      if (rowParts.length < depth || !row.label?.startsWith(prefix)) {
        done = true;
        break;
      }

      if (rowParts.length > depth) continue;

      const expectedLabel = prefix + nextInt;
      if (row.label === expectedLabel) {
        done = true;
        break;
      }

      labelUpdates.push({ uuid: row.uuid, label: expectedLabel });
      prefixRenames.push({
        oldPrefix: `${row.label}.`,
        newPrefix: `${expectedLabel}.`,
      });
      nextInt++;
    }

    if (labelUpdates.length > 0) {
      const { error: upsertError } = await client
        .from('passages')
        .upsert(labelUpdates, { onConflict: 'uuid' });
      if (upsertError) {
        console.error('Error normalizing passage labels:', upsertError);
      }

      for (const { oldPrefix, newPrefix } of prefixRenames) {
        const { error: prefixError } = await client.rpc(
          'rename_passage_label_prefix',
          {
            p_work_uuid: workUuid,
            p_old_prefix: oldPrefix,
            p_new_prefix: newPrefix,
          },
        );
        if (prefixError) {
          console.error('Error renaming passage label prefix:', prefixError);
        }
      }
    }

    if (done || data.length < SAVE_PAGE_SIZE) break;
    lastSort = data[data.length - 1].sort;
  }
}

export type SavedPassageRow = {
  uuid: string;
  workUuid: string;
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  xmlId: string | null;
  toh: TohokuCatalogEntry | null;
};

export type SavePassagesWithDeletionsResult = {
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  passages: SavedPassageRow[];
  error?: string;
};

type ExistingPassageRow = PassageRowDTO;

type ExistingAnnotationRow = AnnotationDTO & {
  passage_uuid: string;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const nullableEqual = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

const passageRowHasChanged = (
  incoming: PassageRowDTO,
  existing?: ExistingPassageRow,
) => {
  if (!existing) {
    return true;
  }

  return (
    incoming.content !== existing.content ||
    incoming.label !== existing.label ||
    incoming.sort !== existing.sort ||
    incoming.type !== existing.type ||
    incoming.work_uuid !== existing.work_uuid ||
    !nullableEqual(incoming.xmlId, existing.xmlId) ||
    !nullableEqual(incoming.parent, existing.parent) ||
    stableStringify(incoming.toh ?? null) !==
      stableStringify(existing.toh ?? null)
  );
};

const annotationHasChanged = (
  incoming: AnnotationDTO,
  existing?: ExistingAnnotationRow,
) => {
  if (!existing) {
    return true;
  }

  return (
    incoming.start !== existing.start ||
    incoming.end !== existing.end ||
    incoming.type !== existing.type ||
    (incoming.passage_uuid ?? incoming.passageUuid ?? '') !==
      existing.passage_uuid ||
    stableStringify(incoming.content ?? []) !==
      stableStringify(existing.content ?? []) ||
    stableStringify(incoming.toh ?? null) !==
      stableStringify(existing.toh ?? null)
  );
};

export const savePassagesWithDeletions = async ({
  client,
  passages,
  deletedUuids = [],
}: {
  client: DataClient;
  passages: Passage[];
  deletedUuids?: string[];
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
  const sortedNewPassages = [...newPassages].sort((a, b) => b.sort - a.sort);

  for (const passage of sortedNewPassages) {
    const { error } = await client.rpc('shift_passage_sorts', {
      p_work_uuid: passage.workUuid,
      p_from_sort: passage.sort,
      p_delta: 1,
    });
    if (error) {
      console.error('Error shifting passage sorts:', error);
    }
  }

  for (const passage of sortedNewPassages) {
    await normalizePassageLabelsAfter({
      client,
      workUuid: passage.workUuid,
      fromSort: passage.sort,
      fromLabel: passage.label,
      delta: 1,
    });
  }

  let deletedCount = 0;
  if (deletedUuids.length > 0) {
    const { data: deletedPassages } = await client
      .from('passages')
      .select('uuid, sort, label, work_uuid')
      .in('uuid', deletedUuids);

    if (deletedPassages && deletedPassages.length > 0) {
      const sortedDeleted = [...deletedPassages].sort(
        (a, b) => b.sort - a.sort,
      );
      for (const deletedPassage of sortedDeleted) {
        await normalizePassageLabelsAfter({
          client,
          workUuid: deletedPassage.work_uuid,
          fromSort: deletedPassage.sort,
          fromLabel: deletedPassage.label,
          delta: -1,
        });
      }

      const { error: deleteAnnotationsError } = await client
        .from('passage_annotations')
        .delete()
        .in('passage_uuid', deletedUuids);

      if (deleteAnnotationsError) {
        console.error(
          'Error deleting annotations for deleted passages:',
          deleteAnnotationsError,
        );
      }

      const { error: deletePassagesError } = await client
        .from('passages')
        .delete()
        .in('uuid', deletedUuids);

      if (deletePassagesError) {
        console.error('Error deleting passages:', deletePassagesError);
        return {
          success: false,
          savedCount: 0,
          passages: [],
          error: `Failed to delete passages: ${deletePassagesError.message}`,
        };
      }

      deletedCount = deletedPassages.length;
    }
  }

  const dtos = passagesToDTO(passages);
  const passageRowDtos = passagesToRowDTO(passages);
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
      row,
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

  const annotationsToDelete = existingAnnotations?.filter(
    (existingAnnotation) =>
      !annotations.find(
        (annotation) => annotation.uuid === existingAnnotation.uuid,
      ),
  );

  if (passageRowsToUpsert.length > 0) {
    const { error: passageError } = await client
      .from('passages')
      .upsert(passageRowsToUpsert, { onConflict: 'uuid' });

    if (passageError) {
      console.error('Error saving passages:', passageError);
      return {
        success: false,
        savedCount: 0,
        passages: [],
        error: `Failed to save passages: ${passageError.message}`,
      };
    }
  }

  if (annotationsToUpsert.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotationsToUpsert, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving annotations:', annotationError);
      return {
        success: false,
        savedCount: passages.length,
        passages: [],
        error: `Passages saved but annotations failed: ${annotationError.message}`,
      };
    }
  }

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

  return {
    success: true,
    savedCount: passages.length,
    deletedCount,
    passages: savedPassages,
  };
};
