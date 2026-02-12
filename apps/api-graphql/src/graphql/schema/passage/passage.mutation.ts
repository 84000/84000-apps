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
  error?: string;
}

/**
 * Mutation resolver for saving passages
 */
export const savePassagesMutation = async (
  _parent: unknown,
  args: { passages: PassageInput[] },
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
