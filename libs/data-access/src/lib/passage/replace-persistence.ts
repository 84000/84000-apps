import {
  ANNOTATIONS_TO_IGNORE,
  AnnotationDTO,
  DataClient,
  annotationRangeFits,
} from '../types';
import { readAnnotationsByPassageUuids } from './batch';
import { inBatches } from './in-batches';

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
  const rowsByUuid = new Map<string, ReplacePassageRow>();
  for (const batch of inBatches(targetUuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, work_uuid, content, label, sort, type, toh, xmlId')
      .in('uuid', batch);

    if (error) {
      console.error('Error fetching replace targets:', error);
      return {
        ok: false as const,
        error: `Failed to fetch replace targets: ${error.message}`,
      };
    }
    (data ?? []).forEach((row) =>
      rowsByUuid.set(row.uuid, row as ReplacePassageRow),
    );
  }

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

const ignored = new Set<string>(ANNOTATIONS_TO_IGNORE);

/**
 * The stored annotations a replace moves, by passage, and the ones it must
 * leave exactly as stored because they do not fit their passage's text. A
 * save writes a passage's full annotation state, so every row is read.
 */
export const fetchReplaceAnnotations = async ({
  client,
  rows,
}: {
  client: DataClient;
  rows: ReplacePassageRow[];
}) => {
  const read = await readAnnotationsByPassageUuids({
    client,
    passageUuids: rows.map((row) => row.uuid),
    source: 'draft',
  });
  if ('error' in read) {
    console.error('Error fetching annotations for replace:', read.error);
    return {
      ok: false as const,
      error: `Failed to fetch annotations: ${read.error}`,
    };
  }

  const lengths = new Map(rows.map((row) => [row.uuid, row.content.length]));
  const annotationsByPassageUuid = new Map<string, AnnotationDTO[]>();
  const keepAnnotationUuids: string[] = [];
  read.data.forEach((annotations, passageUuid) => {
    const length = lengths.get(passageUuid) ?? 0;
    annotationsByPassageUuid.set(
      passageUuid,
      annotations.filter((annotation) => {
        const fits = annotationRangeFits(
          annotation.start,
          annotation.end,
          length,
        );
        if (!fits && !ignored.has(annotation.type)) {
          keepAnnotationUuids.push(annotation.uuid);
        }
        return fits;
      }),
    );
  });

  return {
    ok: true as const,
    annotationsByPassageUuid,
    keepAnnotationUuids,
  };
};
