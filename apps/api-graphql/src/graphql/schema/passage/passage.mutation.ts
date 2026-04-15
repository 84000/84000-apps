import type { GraphQLContext } from '../../context';
import {
  Passage,
  Annotation,
  findLiteralOccurrences,
  fetchReplaceAnnotations,
  fetchReplaceRows,
  hasPermission,
  persistReplaceChanges,
  replacePassageText,
  savePassagesWithDeletions,
} from '@eightyfourthousand/data-access';
import {
  buildAnnotationsByPassageUuid,
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
}

interface SavePassagesResult {
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  error?: string;
}

const requireEditorEditPermission = async (ctx: GraphQLContext) => {
  if (!ctx.session) {
    return {
      ok: false as const,
      error: 'Not authenticated',
    };
  }

  const permitted = await hasPermission({
    client: ctx.supabase,
    permission: 'editor.edit',
  });

  if (!permitted) {
    return {
      ok: false as const,
      error: 'Permission denied: editor.edit required',
    };
  }

  return { ok: true as const };
};

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
      error: permission.error,
    };
  }

  try {
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
    }));

    return savePassagesWithDeletions({
      client: ctx.supabase,
      passages,
      deletedUuids: args.deletedUuids,
    });
  } catch (error) {
    console.error('Unexpected error saving passages:', error);
    return {
      success: false,
      savedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
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

    const annotationsResult = await fetchReplaceAnnotations({
      client: ctx.supabase,
      targetUuids,
    });
    if (!annotationsResult.ok) {
      return replaceFailure(annotationsResult.error);
    }

    const orderedRows = rowsResult.orderedRows;
    const rawAnnotations = annotationsResult.rawAnnotations;
    const annotationsByPassageUuid = buildAnnotationsByPassageUuid(rawAnnotations);

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

        const occurrences = findLiteralOccurrences(row.content, args.searchText);
        occurrenceIndex =
          row.uuid === cursorPassageUuid
            ? occurrences.findIndex((occurrence) => occurrence.start >= cursorStart)
            : occurrences.length > 0
              ? 0
              : -1;

        if (typeof occurrenceIndex === 'number' && occurrenceIndex < 0) {
          continue;
        }
      } else if (remainingOccurrenceIndex !== undefined) {
        const occurrences = findLiteralOccurrences(row.content, args.searchText);
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
        });

        nextPassageUuid = nextCursor?.passageUuid ?? null;
        nextOccurrenceStart = nextCursor?.start ?? null;
        singleOccurrenceApplied = true;
      }
    }

    if (updatedPassages.length === 0) {
      return replaceSuccess({});
    }

    const persistResult = await persistReplaceChanges({
      client: ctx.supabase,
      rawAnnotations,
      updatedPassages,
    });
    if (!persistResult.ok) {
      return replaceFailure(persistResult.error);
    }

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
