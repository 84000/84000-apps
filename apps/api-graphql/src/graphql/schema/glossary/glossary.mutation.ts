import {
  removeGlossaryTermInstances,
  type RemoveGlossaryTermInstancesResult,
} from '@eightyfourthousand/data-access';
import {
  requireEditorEditPermission,
  type GraphQLContext,
} from '../../context';

/** Removes glossary instances of one term. Requires editor.edit. */
export const removeGlossaryTermInstancesMutation = async (
  _parent: unknown,
  args: { workUuid: string; termUuid: string; annotationUuids: string[] },
  ctx: GraphQLContext,
): Promise<RemoveGlossaryTermInstancesResult> => {
  const permission = await requireEditorEditPermission(ctx);
  if (!permission.ok) {
    return { removed: [], failed: [], passages: [], error: permission.error };
  }

  return removeGlossaryTermInstances({
    client: ctx.supabase,
    workUuid: args.workUuid,
    termUuid: args.termUuid,
    annotationUuids: args.annotationUuids,
  });
};
