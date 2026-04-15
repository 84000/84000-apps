import {
  AlignmentDTO,
  ANNOTATIONS_TO_IGNORE,
  AnnotationDTO,
  DataClient,
  Passage,
  PassageDTO,
  PassageRowDTO,
  Passages,
  annotationsFromDTO,
  passageFromDTO,
  passagesToDTO,
  passagesToRowDTO,
} from './types';

type ApiPaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

export type PassageConnectionNode = {
  uuid: string;
  workUuid: string;
  content: string;
  label: string | null;
  sort: number;
  type: string;
  toh: string | null;
  xmlId: string | null;
};

export type PassageConnectionPage = {
  nodes: PassageConnectionNode[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

const EMPTY_PASSAGE_CONNECTION: PassageConnectionPage = {
  nodes: [],
  nextCursor: null,
  prevCursor: null,
  hasMoreAfter: false,
  hasMoreBefore: false,
};

const DEFAULT_PASSAGE_CONNECTION_LIMIT = 20;
const MAX_PASSAGE_CONNECTION_LIMIT = 100;
const SAVE_PAGE_SIZE = 500;

export const getPassage = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data } = await client
    .rpc('get_passage_with_annotations', {
      uuid_input: uuid,
    })
    .single();

  if (!data) {
    console.warn(`No passage found for uuid: ${uuid}`);
    return undefined;
  }

  const dto = data as PassageDTO;
  return passageFromDTO(
    dto,
    annotationsFromDTO(dto?.annotations || [], dto?.content.length || 0),
  );
};

export const getPassageByUuidOrXmlId = async ({
  client,
  uuid,
  xmlId,
}: {
  client: DataClient;
  uuid?: string;
  xmlId?: string;
}): Promise<PassageConnectionNode | null> => {
  if (!uuid && !xmlId) {
    return null;
  }

  let query = client
    .from('passages')
    .select('uuid, content, label, sort, type, xmlId, toh, work_uuid');

  if (uuid) {
    query = query.eq('uuid', uuid);
  } else if (xmlId) {
    query = query.eq('xmlId', xmlId);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error(`Error fetching passage ${uuid || xmlId}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    uuid: data.uuid,
    workUuid: data.work_uuid,
    content: data.content,
    label: data.label,
    sort: data.sort,
    type: data.type,
    toh: data.toh ?? null,
    xmlId: data.xmlId ?? null,
  };
};

export const getPassageUuidByXmlId = async ({
  client,
  xmlId,
}: {
  client: DataClient;
  xmlId: string;
}) => {
  const { data, error } = await client
    .from('passages')
    .select('uuid, workUuid:work_uuid')
    .eq('xmlId', xmlId)
    .single();

  if (error) {
    console.error(`Error fetching passage uuid for xmlId: ${xmlId}`, error);
    return;
  }

  return data?.uuid;
};

function buildPassageConnection(
  nodes: PassageConnectionNode[],
  nextCursor: string | null,
  prevCursor: string | null,
  hasMoreAfter: boolean,
  hasMoreBefore: boolean,
): PassageConnectionPage {
  return {
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
  };
}

function rowToPassageConnectionNode(
  row: PassageRowDTO,
  workUuid: string,
): PassageConnectionNode {
  return {
    uuid: row.uuid,
    workUuid,
    content: row.content,
    label: row.label,
    sort: row.sort,
    type: row.type,
    toh: row.toh ?? null,
    xmlId: row.xmlId ?? null,
  };
}

export const getWorkPassagesConnection = async ({
  client,
  workUuid,
  cursor,
  limit = DEFAULT_PASSAGE_CONNECTION_LIMIT,
  filter,
  direction = 'FORWARD',
}: {
  client: DataClient;
  workUuid: string;
  cursor?: string;
  limit?: number;
  filter?: { type?: string; types?: string[]; label?: string };
  direction?: ApiPaginationDirection;
}): Promise<PassageConnectionPage> => {
  const clampedLimit = Math.min(
    Math.max(limit, 1),
    MAX_PASSAGE_CONNECTION_LIMIT,
  );

  if (direction === 'AROUND') {
    return getWorkPassagesAround({
      client,
      workUuid,
      cursor,
      limit: clampedLimit,
      filter,
    });
  }

  const isForward = direction === 'FORWARD';
  let cursorSort: number | null = null;
  if (cursor) {
    const { data: cursorPassage } = await client
      .from('passages')
      .select('sort')
      .eq('uuid', cursor)
      .single();

    if (cursorPassage) {
      cursorSort = cursorPassage.sort;
    }
  }

  let query = client
    .from('passages')
    .select('uuid, content, label, sort, type, toh, xmlId, work_uuid')
    .eq('work_uuid', workUuid)
    .order('sort', { ascending: isForward })
    .limit(clampedLimit + 1);

  if (cursorSort !== null) {
    query = isForward ? query.gt('sort', cursorSort) : query.lt('sort', cursorSort);
  }

  if (filter?.types && filter.types.length > 0) {
    query = query.in('type', filter.types);
  } else if (filter?.type) {
    query = query.filter('type', 'match', `${filter.type}.*`);
  }

  if (filter?.label) {
    query = query.ilike('label', filter.label);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching passages:', error);
    return EMPTY_PASSAGE_CONNECTION;
  }

  const passages = (data ?? []) as PassageRowDTO[];
  const hasMore = passages.length > clampedLimit;
  let resultPassages = hasMore ? passages.slice(0, clampedLimit) : passages;

  if (!isForward) {
    resultPassages = resultPassages.reverse();
  }

  const hasMoreAfter = isForward ? hasMore : cursorSort !== null;
  const hasMoreBefore = isForward ? cursorSort !== null : hasMore;

  if (resultPassages.length === 0) {
    return buildPassageConnection([], null, null, false, hasMoreBefore);
  }

  const nodes = resultPassages.map((row) =>
    rowToPassageConnectionNode(row, workUuid),
  );
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];

  return buildPassageConnection(
    nodes,
    hasMoreAfter ? lastPassage.uuid : null,
    hasMoreBefore ? firstPassage.uuid : null,
    hasMoreAfter,
    hasMoreBefore,
  );
};

export const getWorkPassagesAround = async ({
  client,
  workUuid,
  cursor,
  limit,
  filter,
}: {
  client: DataClient;
  workUuid: string;
  cursor?: string;
  limit: number;
  filter?: { type?: string; types?: string[]; label?: string };
}): Promise<PassageConnectionPage> => {
  if (!cursor) {
    console.error('AROUND direction requires a cursor');
    return EMPTY_PASSAGE_CONNECTION;
  }

  const { data: cursorPassage } = await client
    .from('passages')
    .select('sort')
    .eq('uuid', cursor)
    .single();

  if (!cursorPassage) {
    console.error('Cursor passage not found');
    return EMPTY_PASSAGE_CONNECTION;
  }

  const cursorSort = cursorPassage.sort;
  const limitBefore = Math.floor(limit / 2);
  const limitAfter = limit - limitBefore;
  const baseSelect = 'uuid, content, label, sort, type, toh, xmlId, work_uuid';

  let beforeQuery = client
    .from('passages')
    .select(baseSelect)
    .eq('work_uuid', workUuid)
    .lt('sort', cursorSort)
    .order('sort', { ascending: false })
    .limit(limitBefore + 1);

  let afterQuery = client
    .from('passages')
    .select(baseSelect)
    .eq('work_uuid', workUuid)
    .gte('sort', cursorSort)
    .order('sort', { ascending: true })
    .limit(limitAfter + 1);

  if (filter?.types && filter.types.length > 0) {
    beforeQuery = beforeQuery.in('type', filter.types);
    afterQuery = afterQuery.in('type', filter.types);
  } else if (filter?.type) {
    const pattern = `${filter.type}.*`;
    beforeQuery = beforeQuery.filter('type', 'match', pattern);
    afterQuery = afterQuery.filter('type', 'match', pattern);
  }

  if (filter?.label) {
    beforeQuery = beforeQuery.ilike('label', filter.label);
    afterQuery = afterQuery.ilike('label', filter.label);
  }

  const [beforeResult, afterResult] = await Promise.all([
    beforeQuery,
    afterQuery,
  ]);

  if (beforeResult.error || afterResult.error) {
    console.error(
      'Error fetching passages around:',
      beforeResult.error || afterResult.error,
    );
    return EMPTY_PASSAGE_CONNECTION;
  }

  const passagesBefore = (beforeResult.data ?? []) as PassageRowDTO[];
  const passagesAfter = (afterResult.data ?? []) as PassageRowDTO[];
  const hasMoreBefore = passagesBefore.length > limitBefore;
  const hasMoreAfter = passagesAfter.length > limitAfter;
  const trimmedBefore = hasMoreBefore
    ? passagesBefore.slice(0, limitBefore)
    : passagesBefore;
  const trimmedAfter = hasMoreAfter
    ? passagesAfter.slice(0, limitAfter)
    : passagesAfter;
  const resultPassages = [...trimmedBefore.reverse(), ...trimmedAfter];

  if (resultPassages.length === 0) {
    return EMPTY_PASSAGE_CONNECTION;
  }

  const nodes = resultPassages.map((row) =>
    rowToPassageConnectionNode(row, workUuid),
  );
  const firstPassage = resultPassages[0];
  const lastPassage = resultPassages[resultPassages.length - 1];

  return buildPassageConnection(
    nodes,
    hasMoreAfter ? lastPassage.uuid : null,
    hasMoreBefore ? firstPassage.uuid : null,
    hasMoreAfter,
    hasMoreBefore,
  );
};

export const getAnnotationsByPassageUuids = async ({
  client,
  passageUuids,
}: {
  client: DataClient;
  passageUuids: readonly string[];
}): Promise<Map<string, AnnotationDTO[]>> => {
  const annotationsByPassage = new Map<string, AnnotationDTO[]>();
  if (passageUuids.length === 0) return annotationsByPassage;

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
  if (passageUuids.length === 0) return alignmentsByPassage;

  const pageSize = 1000;
  let allData: (AlignmentDTO & { passage_uuid: string })[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from('passage_alignments')
      .select('passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number')
      .in('passage_uuid', passageUuids as string[])
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error batch loading alignments:', error);
      return new Map();
    }

    allData = allData.concat(
      (data ?? []) as (AlignmentDTO & { passage_uuid: string })[],
    );
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
  if (passageUuids.length === 0) return labelsByUuid;

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
  if (passageUuids.length === 0) return referencesByTargetUuid;

  const { data: annotations, error: annotationsError } = await client.rpc(
    'get_passage_annotations_by_content_uuids',
    {
      annotation_type: 'end-note-link',
      target_uuids: passageUuids as string[],
    },
  );

  if (annotationsError) {
    console.error('Error batch loading passage reference annotations:', annotationsError);
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
    const sourceSet = targetToSourceUuids.get(row.target_uuid) ?? new Set<string>();
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

export type SavePassagesWithDeletionsResult = {
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  error?: string;
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
  const { data: existingRows } = await client
    .from('passages')
    .select('uuid')
    .in('uuid', inputUuids);
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
      const sortedDeleted = [...deletedPassages].sort((a, b) => b.sort - a.sort);
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
  const { data: existingAnnotations } = await client
    .from('passage_annotations')
    .select('uuid')
    .in('passage_uuid', passageUuids)
    .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

  const annotationsToDelete = existingAnnotations?.filter(
    (existingAnnotation) =>
      !annotations.find((annotation) => annotation.uuid === existingAnnotation.uuid),
  );

  const { error: passageError } = await client
    .from('passages')
    .upsert(passageRowDtos, { onConflict: 'uuid' });

  if (passageError) {
    console.error('Error saving passages:', passageError);
    return {
      success: false,
      savedCount: 0,
      error: `Failed to save passages: ${passageError.message}`,
    };
  }

  if (annotations.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotations, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving annotations:', annotationError);
      return {
        success: false,
        savedCount: passages.length,
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

  return {
    success: true,
    savedCount: passages.length,
    deletedCount,
  };
};

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
