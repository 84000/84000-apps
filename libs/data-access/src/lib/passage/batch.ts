import {
  AlignmentDTO,
  AnnotationDTO,
  DataClient,
  Passage,
  PassageDTO,
  Passages,
  passageFromDTO,
} from '../types';

export const getAnnotationsByPassageUuids = async ({
  client,
  passageUuids,
}: {
  client: DataClient;
  passageUuids: readonly string[];
}): Promise<Map<string, AnnotationDTO[]>> => {
  const annotationsByPassage = new Map<string, AnnotationDTO[]>();

  if (passageUuids.length === 0) {
    return annotationsByPassage;
  }

  const pageSize = 1000;
  let allData: AnnotationDTO[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from('passage_annotations')
      .select('uuid, passage_uuid, type, start, end, content, toh')
      .in('passage_uuid', passageUuids as string[])
      .not('type', 'like', 'deprecated%')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error batch loading annotations:', error);
      return new Map();
    }

    allData = allData.concat((data ?? []) as AnnotationDTO[]);
    hasMore = (data?.length ?? 0) === pageSize;
    offset += pageSize;
  }

  for (const annotation of allData) {
    const passageUuid = annotation.passage_uuid;
    if (!passageUuid) continue;
    const existing = annotationsByPassage.get(passageUuid);
    if (existing) {
      existing.push(annotation);
    } else {
      annotationsByPassage.set(passageUuid, [annotation]);
    }
  }

  for (const annotations of annotationsByPassage.values()) {
    annotations.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end;
    });
  }

  return annotationsByPassage;
};

export const getAlignmentsByPassageUuids = async ({
  client,
  passageUuids,
}: {
  client: DataClient;
  passageUuids: readonly string[];
}): Promise<Map<string, AlignmentDTO[]>> => {
  const alignmentsByPassage = new Map<string, AlignmentDTO[]>();

  if (passageUuids.length === 0) {
    return alignmentsByPassage;
  }

  const pageSize = 1000;
  let allData: (AlignmentDTO & { passage_uuid: string })[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from('passage_alignments')
      .select(
        'passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number',
      )
      .in('passage_uuid', passageUuids as string[])
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error batch loading alignments:', error);
      return new Map();
    }

    allData = allData.concat((data ?? []) as AlignmentDTO[]);
    hasMore = (data?.length ?? 0) === pageSize;
    offset += pageSize;
  }

  for (const row of allData) {
    const existing = alignmentsByPassage.get(row.passage_uuid);
    if (existing) {
      existing.push(row);
    } else {
      alignmentsByPassage.set(row.passage_uuid, [row]);
    }
  }

  return alignmentsByPassage;
};

export const getPassageLabelsByUuids = async ({
  client,
  passageUuids,
}: {
  client: DataClient;
  passageUuids: readonly string[];
}): Promise<Map<string, string>> => {
  const labelsByUuid = new Map<string, string>();

  if (passageUuids.length === 0) {
    return labelsByUuid;
  }

  const { data, error } = await client
    .from('passages')
    .select('uuid, label')
    .in('uuid', passageUuids as string[]);

  if (error) {
    console.error('Error batch loading passage labels:', error);
    return labelsByUuid;
  }

  for (const passage of data ?? []) {
    if (passage.label) {
      labelsByUuid.set(passage.uuid, passage.label);
    }
  }

  return labelsByUuid;
};

export const getPassageReferencesByTargetUuids = async ({
  client,
  passageUuids,
}: {
  client: DataClient;
  passageUuids: readonly string[];
}): Promise<Map<string, Passages>> => {
  const referencesByTargetUuid = new Map<string, Passages>();

  if (passageUuids.length === 0) {
    return referencesByTargetUuid;
  }

  const { data: annotations, error: annotationsError } = await client.rpc(
    'get_passage_annotations_by_content_uuids',
    {
      annotation_type: 'end-note-link',
      target_uuids: passageUuids as string[],
    },
  );

  if (annotationsError) {
    console.error(
      'Error batch loading passage reference annotations:',
      annotationsError,
    );
    return referencesByTargetUuid;
  }

  const targetToSourceUuids = new Map<string, Set<string>>();
  const allSourceUuids = new Set<string>();

  for (const row of (annotations ?? []) as Array<{
    passage_uuid: string;
    target_uuid: string;
  }>) {
    if (!row.target_uuid || !row.passage_uuid) continue;
    allSourceUuids.add(row.passage_uuid);
    const sourceSet =
      targetToSourceUuids.get(row.target_uuid) ?? new Set<string>();
    sourceSet.add(row.passage_uuid);
    targetToSourceUuids.set(row.target_uuid, sourceSet);
  }

  const sourceUuidArray = Array.from(allSourceUuids);
  const passageMap = new Map<string, Passage>();
  const inBatchSize = 300;

  for (let i = 0; i < sourceUuidArray.length; i += inBatchSize) {
    const batch = sourceUuidArray.slice(i, i + inBatchSize);
    const { data, error } = await client
      .from('passages')
      .select('uuid, content, label, sort, type, toh, xmlId, work_uuid')
      .in('uuid', batch);

    if (error) {
      console.error('Error batch loading passage reference data:', error);
      return new Map();
    }

    for (const row of (data ?? []) as PassageDTO[]) {
      passageMap.set(row.uuid, passageFromDTO(row));
    }
  }

  for (const targetUuid of passageUuids) {
    const sourceUuids = targetToSourceUuids.get(targetUuid);
    if (!sourceUuids) continue;
    const references: Passages = [];
    for (const sourceUuid of sourceUuids) {
      const passage = passageMap.get(sourceUuid);
      if (passage) references.push(passage);
    }
    referencesByTargetUuid.set(
      targetUuid,
      references.sort((a, b) => a.sort - b.sort),
    );
  }

  return referencesByTargetUuid;
};
