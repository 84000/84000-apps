import type { GraphQLContext } from '../../context';
import {
  ANNOTATIONS_TO_IGNORE,
  AnnotationDTO,
  DataClient,
  Passage,
  Annotation,
  annotationsFromDTO,
  findLiteralOccurrences,
  replacePassageText,
  passagesToDTO,
  passagesToRowDTO,
} from '@eightyfourthousand/data-access';

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

interface ReplaceResult {
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
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: permission.error,
    };
  }

  const replaceType = args.type ?? 'PASSAGE';
  if (replaceType !== 'PASSAGE') {
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: `Unsupported replace type: ${replaceType}`,
    };
  }

  const targetUuids = Array.from(new Set(args.targetUuids.filter(Boolean)));
  if (targetUuids.length === 0) {
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: 'At least one target UUID is required',
    };
  }

  if (!args.searchText) {
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: 'searchText is required',
    };
  }

  if (
    args.occurrenceIndex !== undefined &&
    (!Number.isInteger(args.occurrenceIndex) || args.occurrenceIndex < 0)
  ) {
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: 'occurrenceIndex must be a non-negative integer',
    };
  }

  if (
    args.cursorStart !== undefined &&
    (!Number.isInteger(args.cursorStart) || args.cursorStart < 0)
  ) {
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: 'cursorStart must be a non-negative integer',
    };
  }

  if (args.searchText === args.replaceText) {
    return {
      success: true,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
    };
  }

  try {
    const { data: rows, error: rowsError } = await ctx.supabase
      .from('passages')
      .select('uuid, work_uuid, content, label, sort, type, toh, xmlId')
      .in('uuid', targetUuids);

    if (rowsError) {
      console.error('Error fetching replace targets:', rowsError);
      return {
        success: false,
        updatedCount: 0,
        replacedOccurrenceCount: 0,
        updatedAnnotationCount: 0,
        deletedAnnotationCount: 0,
        nextOccurrenceStart: null,
        nextPassageUuid: null,
        passages: [],
        error: `Failed to fetch replace targets: ${rowsError.message}`,
      };
    }

    const rowsByUuid = new Map((rows ?? []).map((row) => [row.uuid, row]));
    const missingUuids = targetUuids.filter((uuid) => !rowsByUuid.has(uuid));
    if (missingUuids.length > 0) {
      return {
        success: false,
        updatedCount: 0,
        replacedOccurrenceCount: 0,
        updatedAnnotationCount: 0,
        deletedAnnotationCount: 0,
        nextOccurrenceStart: null,
        nextPassageUuid: null,
        passages: [],
        error: `Unknown target UUIDs: ${missingUuids.join(', ')}`,
      };
    }

    const orderedRows = targetUuids
      .map((uuid) => rowsByUuid.get(uuid))
      .filter(
        (
          row,
        ): row is NonNullable<typeof rows>[number] & {
          work_uuid: string;
        } => Boolean(row),
      );

    const { data: rawAnnotations, error: annotationsError } = await ctx.supabase
      .from('passage_annotations')
      .select('uuid, content, end, start, type, passage_uuid, toh')
      .in('passage_uuid', targetUuids)
      .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`);

    if (annotationsError) {
      console.error('Error fetching annotations for replace:', annotationsError);
      return {
        success: false,
        updatedCount: 0,
        replacedOccurrenceCount: 0,
        updatedAnnotationCount: 0,
        deletedAnnotationCount: 0,
        nextOccurrenceStart: null,
        nextPassageUuid: null,
        passages: [],
        error: `Failed to fetch annotations: ${annotationsError.message}`,
      };
    }

    const annotationsByPassageUuid = new Map<string, AnnotationDTO[]>();
    for (const annotation of (rawAnnotations ?? []) as AnnotationDTO[]) {
      const passageUuid = annotation.passage_uuid || annotation.passageUuid;
      if (!passageUuid) {
        continue;
      }
      const existing = annotationsByPassageUuid.get(passageUuid) || [];
      existing.push(annotation);
      annotationsByPassageUuid.set(passageUuid, existing);
    }

    const updatedPassages: Passage[] = [];
    let updatedAnnotationCount = 0;
    let deletedAnnotationCount = 0;
    let replacedOccurrenceCount = 0;
    let remainingOccurrenceIndex = args.occurrenceIndex;
    let singleOccurrenceApplied = false;
    let nextOccurrenceStart: number | null = null;
    let nextPassageUuid: string | null = null;

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

        if (occurrenceIndex < 0) {
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
        passage: {
          uuid: row.uuid,
          workUuid: row.work_uuid,
          content: row.content,
          label: row.label ?? '',
          sort: row.sort,
          type: row.type as Passage['type'],
          toh: row.toh ?? undefined,
          xmlId: row.xmlId ?? undefined,
          annotations: annotationsFromDTO(
            annotationsByPassageUuid.get(row.uuid),
            row.content.length,
          ) as Annotation[],
        },
        searchText: args.searchText,
        replaceText: args.replaceText,
        occurrenceIndex,
      });

      if (replacement.replacementsApplied === 0) {
        continue;
      }

      updatedPassages.push(replacement.passage);
      updatedAnnotationCount += replacement.updatedAnnotationCount;
        deletedAnnotationCount += replacement.deletedAnnotationCount;
        replacedOccurrenceCount += replacement.replacementsApplied;

        if (args.occurrenceIndex !== undefined && replacement.replacementsApplied > 0) {
          singleOccurrenceApplied = true;
        }

        if (
          (args.occurrenceIndex !== undefined ||
            args.cursorPassageUuid !== undefined ||
            args.cursorStart !== undefined) &&
          replacement.replacementsApplied > 0
        ) {
          nextPassageUuid = row.uuid;
          nextOccurrenceStart = replacement.nextSearchStart ?? null;
          singleOccurrenceApplied = true;
        }
      }

    if (updatedPassages.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        replacedOccurrenceCount: 0,
        updatedAnnotationCount: 0,
        deletedAnnotationCount: 0,
        nextOccurrenceStart: null,
        nextPassageUuid: null,
        passages: [],
      };
    }

    const passageRowDtos = passagesToRowDTO(updatedPassages);
    const annotationDtos = passagesToDTO(updatedPassages).flatMap(
      (passage) => passage.annotations || [],
    );
    const updatedPassageUuids = updatedPassages.map((passage) => passage.uuid);
    const updatedAnnotationUuids = new Set(annotationDtos.map((a) => a.uuid));
    const annotationsToDelete = ((rawAnnotations ?? []) as AnnotationDTO[]).filter(
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
        success: false,
        updatedCount: 0,
        replacedOccurrenceCount: 0,
        updatedAnnotationCount: 0,
        deletedAnnotationCount: 0,
        nextOccurrenceStart: null,
        nextPassageUuid: null,
        passages: [],
        error: `Failed to save replaced passages: ${passageError.message}`,
      };
    }

    if (annotationDtos.length > 0) {
      const { error: annotationError } = await ctx.supabase
        .from('passage_annotations')
        .upsert(annotationDtos, { onConflict: 'uuid' });

      if (annotationError) {
        console.error('Error saving replaced annotations:', annotationError);
        return {
          success: false,
          updatedCount: 0,
          replacedOccurrenceCount: 0,
          updatedAnnotationCount: 0,
          deletedAnnotationCount: 0,
          nextOccurrenceStart: null,
          nextPassageUuid: null,
          passages: [],
          error: `Failed to save replaced annotations: ${annotationError.message}`,
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
          success: false,
          updatedCount: 0,
          replacedOccurrenceCount: 0,
          updatedAnnotationCount: 0,
          deletedAnnotationCount: 0,
          nextOccurrenceStart: null,
          nextPassageUuid: null,
          passages: [],
          error: `Failed to delete replaced annotations: ${deleteError.message}`,
        };
      }
    }

    return {
      success: true,
      updatedCount: updatedPassages.length,
      replacedOccurrenceCount,
      updatedAnnotationCount,
      deletedAnnotationCount,
      nextOccurrenceStart,
      nextPassageUuid,
      passages: orderedRows
        .filter((row) => updatedPassageUuids.includes(row.uuid))
        .map((row) => {
          const updatedPassage = updatedPassages.find(
            (passage) => passage.uuid === row.uuid,
          );

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
        }),
    };
  } catch (error) {
    console.error('Unexpected error replacing passages:', error);
    return {
      success: false,
      updatedCount: 0,
      replacedOccurrenceCount: 0,
      updatedAnnotationCount: 0,
      deletedAnnotationCount: 0,
      nextOccurrenceStart: null,
      nextPassageUuid: null,
      passages: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
