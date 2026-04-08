import type { GraphQLContext } from '../../context';
import {
  ANNOTATIONS_TO_IGNORE,
  DataClient,
  Passage,
  Annotation,
  findLiteralOccurrences,
  replacePassageText,
  passagesToDTO,
  passagesToRowDTO,
} from '@eightyfourthousand/data-access';
import {
  buildAnnotationsByPassageUuid,
  buildReplacePassage,
  buildReplaceResponsePassages,
  fetchReplaceAnnotations,
  fetchReplaceRows,
  findNextReplaceCursor,
  persistReplaceChanges,
  replaceFailure,
  replaceSuccess,
  type ReplacePassageRow,
  type ReplaceResult,
  validateReplaceArgs,
} from './passage.replace';

const PAGE_SIZE = 500;

async function normalizePassageLabelsAfter(
  supabase: DataClient,
  workUuid: string,
  fromSort: number,
  fromLabel: string,
  delta: number, // +1 for insert, -1 for delete
): Promise<void> {
  const parts = fromLabel.split('.');
  const depth = parts.length;
  const prefix = depth > 1 ? parts.slice(0, -1).join('.') + '.' : '';
  let nextInt = parseInt(parts[depth - 1], 10) + Math.max(delta, 0);

  let lastSort = fromSort;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from('passages')
      .select('uuid, label, sort')
      .eq('work_uuid', workUuid)
      .gt('sort', lastSort)
      .order('sort', { ascending: true })
      .limit(PAGE_SIZE);

    if (error || !data || data.length === 0) break;

    const labelUpdates: { uuid: string; label: string }[] = [];
    const prefixRenames: { oldPrefix: string; newPrefix: string }[] = [];

    for (const row of data) {
      const rowParts = (row.label ?? '').split('.');

      if (rowParts.length < depth) {
        done = true;
        break;
      } // shallower → stop
      if (!row.label.startsWith(prefix)) {
        done = true;
        break;
      } // different prefix → stop
      if (rowParts.length > depth) continue; // deeper → skip (handled by prefix rename)

      const expectedLabel = prefix + nextInt;
      if (row.label === expectedLabel) {
        done = true;
        break;
      } // already contiguous → stop

      labelUpdates.push({ uuid: row.uuid, label: expectedLabel });
      prefixRenames.push({
        oldPrefix: row.label + '.',
        newPrefix: expectedLabel + '.',
      });
      nextInt++;
    }

    if (labelUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('passages')
        .upsert(labelUpdates, { onConflict: 'uuid' });
      if (upsertError)
        console.error('Error normalizing passage labels:', upsertError);

      // Fire child prefix renames after same-depth labels are committed
      for (const { oldPrefix, newPrefix } of prefixRenames) {
        const { error: prefixError } = await supabase.rpc(
          'rename_passage_label_prefix',
          {
            p_work_uuid: workUuid,
            p_old_prefix: oldPrefix,
            p_new_prefix: newPrefix,
          },
        );
        if (prefixError)
          console.error('Error renaming passage label prefix:', prefixError);
      }
    }

    if (done || data.length < PAGE_SIZE) break;
    lastSort = data[data.length - 1].sort;
  }
}

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

  const { data: hasPermission, error: permError } = await ctx.supabase.rpc(
    'authorize',
    {
      requested_permission: 'editor.edit',
    },
  );

  if (permError || !hasPermission) {
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

    // Phase A — Detect new passages
    const inputUuids = passages.map((p) => p.uuid);
    const { data: existingRows } = await ctx.supabase
      .from('passages')
      .select('uuid')
      .in('uuid', inputUuids);
    const existingUuidSet = new Set((existingRows ?? []).map((r) => r.uuid));
    const newPassages = passages.filter((p) => !existingUuidSet.has(p.uuid));

    // Phase B — Sort shift for new passages (descending sort order to avoid conflicts)
    const sortedNewPassages = [...newPassages].sort((a, b) => b.sort - a.sort);
    for (const p of sortedNewPassages) {
      const { error: shiftError } = await ctx.supabase.rpc(
        'shift_passage_sorts',
        {
          p_work_uuid: p.workUuid,
          p_from_sort: p.sort,
          p_delta: 1,
        },
      );
      if (shiftError) {
        console.error('Error shifting passage sorts:', shiftError);
      }
    }

    // Phase C — Normalize labels for new passages
    for (const p of sortedNewPassages) {
      await normalizePassageLabelsAfter(
        ctx.supabase,
        p.workUuid,
        p.sort,
        p.label,
        1,
      );
    }

    // Phase D — Handle deletions
    let deletedCount = 0;
    if (args.deletedUuids && args.deletedUuids.length > 0) {
      // Fetch deleted passage info
      const { data: deletedPassages } = await ctx.supabase
        .from('passages')
        .select('uuid, sort, label, work_uuid')
        .in('uuid', args.deletedUuids);

      if (deletedPassages && deletedPassages.length > 0) {
        // Adjust labels for deleted passages (descending sort order)
        const sortedDeleted = [...deletedPassages].sort(
          (a, b) => b.sort - a.sort,
        );
        for (const dp of sortedDeleted) {
          await normalizePassageLabelsAfter(
            ctx.supabase,
            dp.work_uuid,
            dp.sort,
            dp.label,
            -1,
          );
        }

        // Delete annotations first (passage_annotations has ON DELETE RESTRICT)
        const { error: deleteAnnotationsError } = await ctx.supabase
          .from('passage_annotations')
          .delete()
          .in('passage_uuid', args.deletedUuids);

        if (deleteAnnotationsError) {
          console.error(
            'Error deleting annotations for deleted passages:',
            deleteAnnotationsError,
          );
        }

        // Delete passages
        const { error: deletePassagesError } = await ctx.supabase
          .from('passages')
          .delete()
          .in('uuid', args.deletedUuids);

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

    // Phase E — Existing upsert logic
    // Convert to DTOs
    const dtos = passagesToDTO(passages);
    const passageRowDtos = passagesToRowDTO(passages);
    const passageUuids = passages.map((p) => p.uuid);
    const annotations = dtos.flatMap((p) => p.annotations || []);

    // Get existing annotations to determine deletions
    const { data: existingAnnotations } = await ctx.supabase
      .from('passage_annotations')
      .select('uuid')
      .in('passage_uuid', passageUuids)
      .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

    const annotationsToDelete = existingAnnotations?.filter(
      (ea) => !annotations.find((a) => a.uuid === ea.uuid),
    );

    // Upsert passages
    const { error: passageError } = await ctx.supabase
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

    // Upsert annotations
    if (annotations.length > 0) {
      const { error: annotationError } = await ctx.supabase
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

    // Delete removed annotations
    if (annotationsToDelete && annotationsToDelete.length > 0) {
      const { error: deleteError } = await ctx.supabase
        .from('passage_annotations')
        .delete()
        .in(
          'uuid',
          annotationsToDelete.map((a) => a.uuid),
        );

      if (deleteError) {
        console.error('Error deleting annotations:', deleteError);
        // Non-fatal, continue
      }
    }

    return {
      success: true,
      savedCount: passages.length,
      deletedCount,
    };
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
    const rowsResult = await fetchReplaceRows({ ctx, targetUuids });
    if (!rowsResult.ok) {
      return rowsResult.result;
    }

    const annotationsResult = await fetchReplaceAnnotations({ ctx, targetUuids });
    if (!annotationsResult.ok) {
      return annotationsResult.result;
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
      ctx,
      rawAnnotations,
      updatedPassages,
    });
    if (!persistResult.ok) {
      return persistResult.result;
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
