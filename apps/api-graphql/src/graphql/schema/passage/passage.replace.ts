import type { GraphQLContext } from '../../context';
import {
  ANNOTATIONS_TO_IGNORE,
  Annotation,
  AnnotationDTO,
  Passage,
  annotationsFromDTO,
  findLiteralOccurrences,
  passagesToDTO,
  passagesToRowDTO,
} from '@eightyfourthousand/data-access';

export interface ReplaceResult {
  deletedAnnotationCount: number;
  error?: string;
  nextOccurrenceStart?: number | null;
  nextPassageUuid?: string | null;
  passages: Array<{
    content: string;
    label: string;
    sort: number;
    toh: string | null;
    type: string;
    uuid: string;
    workUuid: string;
    xmlId: string | null;
  }>;
  replacedOccurrenceCount: number;
  success: boolean;
  updatedAnnotationCount: number;
  updatedCount: number;
}

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

const EMPTY_REPLACE_RESULT: Omit<
  ReplaceResult,
  'error' | 'success'
> = {
  updatedCount: 0,
  replacedOccurrenceCount: 0,
  updatedAnnotationCount: 0,
  deletedAnnotationCount: 0,
  nextOccurrenceStart: null,
  nextPassageUuid: null,
  passages: [],
};

export const replaceFailure = (error: string): ReplaceResult => ({
  success: false,
  ...EMPTY_REPLACE_RESULT,
  error,
});

export const replaceSuccess = (
  overrides: Partial<Omit<ReplaceResult, 'success'>>,
): ReplaceResult => ({
  success: true,
  ...EMPTY_REPLACE_RESULT,
  ...overrides,
});

export const validateReplaceArgs = (args: {
  cursorStart?: number;
  occurrenceIndex?: number;
  searchText: string;
  targetUuids: string[];
  type?: 'PASSAGE';
}) => {
  const replaceType = args.type ?? 'PASSAGE';
  if (replaceType !== 'PASSAGE') {
    return {
      ok: false as const,
      result: replaceFailure(`Unsupported replace type: ${replaceType}`),
    };
  }

  const targetUuids = Array.from(new Set(args.targetUuids.filter(Boolean)));
  if (targetUuids.length === 0) {
    return {
      ok: false as const,
      result: replaceFailure('At least one target UUID is required'),
    };
  }

  if (!args.searchText) {
    return {
      ok: false as const,
      result: replaceFailure('searchText is required'),
    };
  }

  if (
    args.occurrenceIndex !== undefined &&
    (!Number.isInteger(args.occurrenceIndex) || args.occurrenceIndex < 0)
  ) {
    return {
      ok: false as const,
      result: replaceFailure('occurrenceIndex must be a non-negative integer'),
    };
  }

  if (
    args.cursorStart !== undefined &&
    (!Number.isInteger(args.cursorStart) || args.cursorStart < 0)
  ) {
    return {
      ok: false as const,
      result: replaceFailure('cursorStart must be a non-negative integer'),
    };
  }

  return {
    ok: true as const,
    targetUuids,
  };
};

export const findNextReplaceCursor = ({
  fromPassageUuid,
  fromStart,
  passages,
  searchText,
  updatedContentByUuid,
}: {
  fromPassageUuid: string;
  fromStart: number;
  passages: Array<{ content: string; uuid: string }>;
  searchText: string;
  updatedContentByUuid: Map<string, string>;
}): { passageUuid: string; start: number } | null => {
  const startIndex = passages.findIndex(
    (passage) => passage.uuid === fromPassageUuid,
  );

  if (startIndex < 0) {
    return null;
  }

  const getContent = (uuid: string, fallback: string) =>
    updatedContentByUuid.get(uuid) ?? fallback;

  const findMatchInPassage = ({
    minStart,
    passage,
  }: {
    minStart: number;
    passage: { content: string; uuid: string };
  }) => {
    const content = getContent(passage.uuid, passage.content);
    const match = findLiteralOccurrences(content, searchText).find(
      (occurrence) => occurrence.start >= minStart,
    );

    return match
      ? {
          passageUuid: passage.uuid,
          start: match.start,
        }
      : null;
  };

  const currentPassage = passages[startIndex];
  const currentPassageMatch = findMatchInPassage({
    minStart: fromStart,
    passage: currentPassage,
  });

  if (currentPassageMatch) {
    return currentPassageMatch;
  }

  for (let index = startIndex + 1; index < passages.length; index++) {
    const match = findMatchInPassage({
      minStart: 0,
      passage: passages[index],
    });

    if (match) {
      return match;
    }
  }

  for (let index = 0; index < startIndex; index++) {
    const match = findMatchInPassage({
      minStart: 0,
      passage: passages[index],
    });

    if (match) {
      return match;
    }
  }

  const wrappedCurrentPassageMatch = findMatchInPassage({
    minStart: 0,
    passage: currentPassage,
  });

  if (
    wrappedCurrentPassageMatch &&
    wrappedCurrentPassageMatch.start < fromStart
  ) {
    return wrappedCurrentPassageMatch;
  }

  return null;
};

export const buildAnnotationsByPassageUuid = (
  rawAnnotations: AnnotationDTO[] | null | undefined,
) => {
  const annotationsByPassageUuid = new Map<string, AnnotationDTO[]>();

  for (const annotation of rawAnnotations ?? []) {
    const passageUuid = annotation.passage_uuid || annotation.passageUuid;
    if (!passageUuid) {
      continue;
    }

    const existing = annotationsByPassageUuid.get(passageUuid) || [];
    existing.push(annotation);
    annotationsByPassageUuid.set(passageUuid, existing);
  }

  return annotationsByPassageUuid;
};

export const buildReplacePassage = ({
  annotationsByPassageUuid,
  row,
}: {
  annotationsByPassageUuid: Map<string, AnnotationDTO[]>;
  row: ReplacePassageRow;
}): Passage => ({
  uuid: row.uuid,
  workUuid: row.work_uuid,
  content: row.content,
  label: row.label ?? '',
  sort: row.sort,
  type: row.type as Passage['type'],
  toh: (row.toh ?? undefined) as Passage['toh'],
  xmlId: row.xmlId ?? undefined,
  annotations: annotationsFromDTO(
    annotationsByPassageUuid.get(row.uuid),
    row.content.length,
  ) as Annotation[],
});

export const buildReplaceResponsePassages = ({
  orderedRows,
  updatedPassages,
}: {
  orderedRows: ReplacePassageRow[];
  updatedPassages: Passage[];
}) => {
  const updatedPassageByUuid = new Map(
    updatedPassages.map((passage) => [passage.uuid, passage]),
  );

  return orderedRows
    .filter((row) => updatedPassageByUuid.has(row.uuid))
    .map((row) => {
      const updatedPassage = updatedPassageByUuid.get(row.uuid);

      return {
        uuid: row.uuid,
        workUuid: row.work_uuid,
        content: updatedPassage?.content ?? row.content,
        label: row.label ?? '',
        sort: row.sort,
        type: row.type,
        toh: row.toh ?? null,
        xmlId: row.xmlId ?? null,
      };
    });
};

export const fetchReplaceRows = async ({
  ctx,
  targetUuids,
}: {
  ctx: GraphQLContext;
  targetUuids: string[];
}) => {
  const { data: rows, error: rowsError } = await ctx.supabase
    .from('passages')
    .select('uuid, work_uuid, content, label, sort, type, toh, xmlId')
    .in('uuid', targetUuids);

  if (rowsError) {
    console.error('Error fetching replace targets:', rowsError);
    return {
      ok: false as const,
      result: replaceFailure(
        `Failed to fetch replace targets: ${rowsError.message}`,
      ),
    };
  }

  const rowsByUuid = new Map((rows ?? []).map((row) => [row.uuid, row]));
  const missingUuids = targetUuids.filter((uuid) => !rowsByUuid.has(uuid));
  if (missingUuids.length > 0) {
    return {
      ok: false as const,
      result: replaceFailure(`Unknown target UUIDs: ${missingUuids.join(', ')}`),
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
  ctx,
  targetUuids,
}: {
  ctx: GraphQLContext;
  targetUuids: string[];
}) => {
  const { data: rawAnnotations, error: annotationsError } = await ctx.supabase
    .from('passage_annotations')
    .select('uuid, content, end, start, type, passage_uuid, toh')
    .in('passage_uuid', targetUuids)
    .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

  if (annotationsError) {
    console.error('Error fetching annotations for replace:', annotationsError);
    return {
      ok: false as const,
      result: replaceFailure(
        `Failed to fetch annotations: ${annotationsError.message}`,
      ),
    };
  }

  return {
    ok: true as const,
    rawAnnotations: (rawAnnotations ?? []) as AnnotationDTO[],
  };
};

export const persistReplaceChanges = async ({
  ctx,
  rawAnnotations,
  updatedPassages,
}: {
  ctx: GraphQLContext;
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

  const { error: passageError } = await ctx.supabase
    .from('passages')
    .upsert(passageRowDtos, { onConflict: 'uuid' });

  if (passageError) {
    console.error('Error saving replaced passages:', passageError);
    return {
      ok: false as const,
      result: replaceFailure(
        `Failed to save replaced passages: ${passageError.message}`,
      ),
    };
  }

  if (annotationDtos.length > 0) {
    const { error: annotationError } = await ctx.supabase
      .from('passage_annotations')
      .upsert(annotationDtos, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving replaced annotations:', annotationError);
      return {
        ok: false as const,
        result: replaceFailure(
          `Failed to save replaced annotations: ${annotationError.message}`,
        ),
      };
    }
  }

  if (annotationsToDelete.length > 0) {
    const { error: deleteError } = await ctx.supabase
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
        result: replaceFailure(
          `Failed to delete replaced annotations: ${deleteError.message}`,
        ),
      };
    }
  }

  return {
    ok: true as const,
  };
};
