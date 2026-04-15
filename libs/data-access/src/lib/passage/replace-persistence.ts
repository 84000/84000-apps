import {
  ANNOTATIONS_TO_IGNORE,
  AnnotationDTO,
  DataClient,
  Passage,
  passagesToDTO,
  passagesToRowDTO,
} from '../types';

export type ReplacePassageRow = {
  content: string;
  label: string | null;
  sort: number;
  toh: string | null;
  type: string;
  uuid: string;
  work_uuid: string;
  xmlId: string | null;
};

export const fetchReplaceRows = async ({
  client,
  targetUuids,
}: {
  client: DataClient;
  targetUuids: string[];
}) => {
  const { data, error } = await client
    .from('passages')
    .select('uuid, work_uuid, content, label, sort, type, toh, xmlId')
    .in('uuid', targetUuids);

  if (error) {
    console.error('Error fetching replace targets:', error);
    return {
      ok: false as const,
      error: `Failed to fetch replace targets: ${error.message}`,
    };
  }

  const rowsByUuid = new Map((data ?? []).map((row) => [row.uuid, row]));
  const missingUuids = targetUuids.filter((uuid) => !rowsByUuid.has(uuid));
  if (missingUuids.length > 0) {
    return {
      ok: false as const,
      error: `Unknown target UUIDs: ${missingUuids.join(', ')}`,
    };
  }

  return {
    ok: true as const,
    orderedRows: targetUuids
      .map((uuid) => rowsByUuid.get(uuid))
      .filter((row): row is ReplacePassageRow => Boolean(row)),
  };
};

export const fetchReplaceAnnotations = async ({
  client,
  targetUuids,
}: {
  client: DataClient;
  targetUuids: string[];
}) => {
  const { data, error } = await client
    .from('passage_annotations')
    .select('uuid, content, end, start, type, passage_uuid, toh')
    .in('passage_uuid', targetUuids)
    .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

  if (error) {
    console.error('Error fetching annotations for replace:', error);
    return {
      ok: false as const,
      error: `Failed to fetch annotations: ${error.message}`,
    };
  }

  return {
    ok: true as const,
    rawAnnotations: (data ?? []) as AnnotationDTO[],
  };
};

export const persistReplaceChanges = async ({
  client,
  rawAnnotations,
  updatedPassages,
}: {
  client: DataClient;
  rawAnnotations: AnnotationDTO[];
  updatedPassages: Passage[];
}) => {
  const passageRowDtos = passagesToRowDTO(updatedPassages);
  const annotationDtos = passagesToDTO(updatedPassages).flatMap(
    (passage) => passage.annotations || [],
  );
  const updatedPassageUuids = updatedPassages.map((passage) => passage.uuid);
  const updatedAnnotationUuids = new Set(annotationDtos.map((a) => a.uuid));
  const annotationsToDelete = rawAnnotations.filter(
    (annotation) =>
      updatedPassageUuids.includes(annotation.passage_uuid || '') &&
      !updatedAnnotationUuids.has(annotation.uuid),
  );

  const { error: passageError } = await client
    .from('passages')
    .upsert(passageRowDtos, { onConflict: 'uuid' });

  if (passageError) {
    console.error('Error saving replaced passages:', passageError);
    return {
      ok: false as const,
      error: `Failed to save replaced passages: ${passageError.message}`,
    };
  }

  if (annotationDtos.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotationDtos, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving replaced annotations:', annotationError);
      return {
        ok: false as const,
        error: `Failed to save replaced annotations: ${annotationError.message}`,
      };
    }
  }

  if (annotationsToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('passage_annotations')
      .delete()
      .in(
        'uuid',
        annotationsToDelete.map((annotation) => annotation.uuid),
      );

    if (deleteError) {
      console.error('Error deleting replaced annotations:', deleteError);
      return {
        ok: false as const,
        error: `Failed to delete replaced annotations: ${deleteError.message}`,
      };
    }
  }

  return {
    ok: true as const,
  };
};
