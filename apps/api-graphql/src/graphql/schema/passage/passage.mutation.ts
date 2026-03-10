import type { GraphQLContext } from '../../context';
import {
  ANNOTATIONS_TO_IGNORE,
  Passage,
  Annotation,
  passagesToDTO,
  passagesToRowDTO,
} from '@data-access';

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

/**
 * Mutation resolver for saving passages
 */
export const savePassagesMutation = async (
  _parent: unknown,
  args: { passages: PassageInput[]; deletedUuids?: string[] },
  ctx: GraphQLContext,
): Promise<SavePassagesResult> => {
  // Check authentication
  if (!ctx.session) {
    return {
      success: false,
      savedCount: 0,
      error: 'Not authenticated',
    };
  }

  // Check permission
  const { data: hasPermission, error: permError } = await ctx.supabase.rpc(
    'authorize',
    {
      requested_permission: 'editor.edit',
    },
  );

  if (permError || !hasPermission) {
    return {
      success: false,
      savedCount: 0,
      error: 'Permission denied: editor.edit required',
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

    // Phase C — Label increment for new passages
    for (const p of sortedNewPassages) {
      const parts = p.label.split('.');
      const prefix = parts.length > 1 ? parts.slice(0, -1).join('.') + '.' : '';
      const { error: labelError } = await ctx.supabase.rpc(
        'adjust_passage_labels',
        {
          p_work_uuid: p.workUuid,
          p_from_sort: p.sort,
          p_prefix: prefix,
          p_delta: 1,
        },
      );
      if (labelError) {
        console.error('Error adjusting passage labels:', labelError);
      }
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
          const parts = (dp.label || '').split('.');
          const prefix =
            parts.length > 1 ? parts.slice(0, -1).join('.') + '.' : '';
          const { error: labelError } = await ctx.supabase.rpc(
            'adjust_passage_labels',
            {
              p_work_uuid: dp.work_uuid,
              p_from_sort: dp.sort,
              p_prefix: prefix,
              p_delta: -1,
            },
          );
          if (labelError) {
            console.error(
              'Error adjusting labels for deleted passage:',
              labelError,
            );
          }
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
