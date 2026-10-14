import {
  requireEditorEditPermission,
  type GraphQLContext,
} from '../../context';
import {
  Passage,
  Annotation,
  findLiteralOccurrences,
  findRegexOccurrences,
  fetchReplaceAnnotations,
  fetchReplaceRows,
  replacePassageText,
  savePassagesWithDeletions,
  type RenumberedPassageRow,
  type SavedPassageRow,
} from '@eightyfourthousand/data-access';
import {
  buildReplacePassage,
  buildReplaceResponsePassages,
  findNextReplaceCursor,
  replaceFailure,
  replaceSuccess,
  type ReplaceResult,
  validateReplaceArgs,
} from './passage.replace';

interface PassageInput {
  uuid: string;
  workUuid: string;
  content: string;
  label: string;
  sort: number;
  type: string;
  xmlId?: string | null;
  // Annotations come as JSON from GraphQL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annotations: any[];
  annotationsIncomplete?: boolean | null;
}

interface SavePassagesResult {
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  passages: SavedPassageRow[];
  renumberedPassages: RenumberedPassageRow[];
  error?: string;
  warnings?: string[];
  /** The save failed, but may have been applied: its answer was lost. */
  outcomeUnknown?: boolean;
}

/**
 * Mutation resolver for saving passages
 */
export const savePassagesMutation = async (
  _parent: unknown,
  args: { passages: PassageInput[]; deletedUuids?: string[] },
  ctx: GraphQLContext,
): Promise<SavePassagesResult> => {
  const permission = await requireEditorEditPermission(ctx);
  if (!permission.ok) {
    return {
      success: false,
      savedCount: 0,
      passages: [],
      renumberedPassages: [],
      error: permission.error,
    };
  }

  // Convert inputs to Passage type
  // The annotations are passed as JSON and cast to the proper type
  const passages: Passage[] = args.passages.map((input) => ({
    uuid: input.uuid,
    workUuid: input.workUuid,
    content: input.content,
    label: input.label,
    sort: input.sort,
    type: input.type as Passage['type'],
    xmlId: input.xmlId ?? undefined,
    annotations: input.annotations as Annotation[],
    annotationsIncomplete: input.annotationsIncomplete ?? undefined,
  }));

  try {
    return await savePassagesWithDeletions({
      client: ctx.supabase,
      passages,
      deletedUuids: args.deletedUuids,
    });
  } catch (error) {
    // The save threw rather than reporting, so it may have thrown after its
    // commit: nothing here says whether the passages were written.
    console.error('Unexpected error saving passages:', error);
    return {
      success: false,
      savedCount: 0,
      passages: [],
      renumberedPassages: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      outcomeUnknown: true,
    };
  }
};

export const replaceMutation = async (
  _parent: unknown,
  args: {
    cursorPassageUuid?: string;
    cursorStart?: number;
    occurrenceIndex?: number;
    replaceText: string;
    searchText: string;
    targetUuids: string[];
    type?: 'PASSAGE';
    useRegex?: boolean;
  },
  ctx: GraphQLContext,
): Promise<ReplaceResult> => {
  const permission = await requireEditorEditPermission(ctx);
  if (!permission.ok) {
    return replaceFailure(permission.error);
  }

  const validation = validateReplaceArgs(args);
  if (!validation.ok) {
    return validation.result;
  }

  const { targetUuids } = validation;

  if (args.searchText === args.replaceText) {
    return replaceSuccess({});
  }

  try {
    const rowsResult = await fetchReplaceRows({
      client: ctx.supabase,
      targetUuids,
    });
    if (!rowsResult.ok) {
      return replaceFailure(rowsResult.error);
    }

    const orderedRows = rowsResult.orderedRows;
    const annotationsResult = await fetchReplaceAnnotations({
      client: ctx.supabase,
      rows: orderedRows,
    });
    if (!annotationsResult.ok) {
      return replaceFailure(annotationsResult.error);
    }
    const { annotationsByPassageUuid, keepAnnotationUuids } = annotationsResult;

    const updatedPassages: Passage[] = [];
    let updatedAnnotationCount = 0;
    let deletedAnnotationCount = 0;
    let replacedOccurrenceCount = 0;
    let remainingOccurrenceIndex = args.occurrenceIndex;
    let singleOccurrenceApplied = false;
    let nextOccurrenceStart: number | null = null;
    let nextPassageUuid: string | null = null;
    const updatedContentByUuid = new Map<string, string>();

    for (const row of orderedRows) {
      if (singleOccurrenceApplied) {
        break;
      }

      let occurrenceIndex = remainingOccurrenceIndex;
      if (
        args.cursorPassageUuid !== undefined ||
        args.cursorStart !== undefined
      ) {
        const cursorPassageUuid = args.cursorPassageUuid;
        const cursorStart = args.cursorStart ?? 0;

        if (cursorPassageUuid && row.uuid !== cursorPassageUuid) {
          const cursorIndex = targetUuids.indexOf(cursorPassageUuid);
          const rowIndex = targetUuids.indexOf(row.uuid);
          if (cursorIndex !== -1 && rowIndex < cursorIndex) {
            continue;
          }
        }

        const findOccurrences = args.useRegex
          ? findRegexOccurrences
          : findLiteralOccurrences;
        const occurrences = findOccurrences(row.content, args.searchText);
        occurrenceIndex =
          row.uuid === cursorPassageUuid
            ? occurrences.findIndex(
                (occurrence) => occurrence.start >= cursorStart,
              )
            : occurrences.length > 0
              ? 0
              : -1;

        if (typeof occurrenceIndex === 'number' && occurrenceIndex < 0) {
          continue;
        }
      } else if (remainingOccurrenceIndex !== undefined) {
        const findOccurrences = args.useRegex
          ? findRegexOccurrences
          : findLiteralOccurrences;
        const occurrences = findOccurrences(row.content, args.searchText);
        if (remainingOccurrenceIndex >= occurrences.length) {
          remainingOccurrenceIndex -= occurrences.length;
          continue;
        }
        occurrenceIndex = remainingOccurrenceIndex;
        remainingOccurrenceIndex = undefined;
      }

      const replacement = replacePassageText({
        passage: buildReplacePassage({ annotationsByPassageUuid, row }),
        searchText: args.searchText,
        replaceText: args.replaceText,
        occurrenceIndex,
        useRegex: args.useRegex,
      });

      if (replacement.replacementsApplied === 0) {
        continue;
      }

      updatedPassages.push(replacement.passage);
      updatedContentByUuid.set(row.uuid, replacement.passage.content);
      updatedAnnotationCount += replacement.updatedAnnotationCount;
      deletedAnnotationCount += replacement.deletedAnnotationCount;
      replacedOccurrenceCount += replacement.replacementsApplied;

      if (
        (args.occurrenceIndex !== undefined ||
          args.cursorPassageUuid !== undefined ||
          args.cursorStart !== undefined) &&
        replacement.replacementsApplied > 0
      ) {
        const nextCursor = findNextReplaceCursor({
          fromPassageUuid: row.uuid,
          fromStart: replacement.nextSearchStart ?? 0,
          passages: orderedRows.map((orderedRow) => ({
            uuid: orderedRow.uuid,
            content: orderedRow.content,
          })),
          searchText: args.searchText,
          updatedContentByUuid,
          useRegex: args.useRegex,
        });

        nextPassageUuid = nextCursor?.passageUuid ?? null;
        nextOccurrenceStart = nextCursor?.start ?? null;
        singleOccurrenceApplied = true;
      }
    }

    if (updatedPassages.length === 0) {
      return replaceSuccess({});
    }

    const saved = await savePassagesWithDeletions({
      client: ctx.supabase,
      passages: updatedPassages,
      keepAnnotationUuids,
    });
    if (!saved.success) {
      return replaceFailure(saved.error ?? 'Failed to save replaced passages');
    }
    saved.warnings?.forEach((warning) => console.warn(warning));

    return replaceSuccess({
      updatedCount: updatedPassages.length,
      replacedOccurrenceCount,
      updatedAnnotationCount,
      deletedAnnotationCount,
      nextOccurrenceStart,
      nextPassageUuid,
      passages: buildReplaceResponsePassages({ orderedRows, updatedPassages }),
    });
  } catch (error) {
    console.error('Unexpected error replacing passages:', error);
    return replaceFailure(
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
};
