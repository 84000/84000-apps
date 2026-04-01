import type { GraphQLContext } from '../../context';
import {
  Passage,
  Annotation,
  savePassagesWithStructure,
} from '@eightyfourthousand/data-access';

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
    const deletedCount = args.deletedUuids?.length || 0;
    await savePassagesWithStructure({
      client: ctx.supabase,
      passages,
      deletedUuids: args.deletedUuids || [],
    });

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
