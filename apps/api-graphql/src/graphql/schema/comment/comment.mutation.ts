import {
  createComment,
  deleteComment,
  replyToComment,
  resolveComment,
  setCommentTags,
  updateComment,
  type CommentDeleteResult,
  type CommentWriteResult,
} from '@eightyfourthousand/data-access';
import {
  requireEditorEditPermission,
  type GraphQLContext,
} from '../../context';

interface CreateCommentInput {
  entityUuid: string;
  entityType: string;
  content: string;
}

const failed = (error: string): CommentWriteResult => ({
  success: false,
  error,
});

const deleteFailed = (error: string): CommentDeleteResult => ({
  success: false,
  deletedUuids: [],
  error,
});

/**
 * Comment mutations.
 *
 * All gate on `editor.edit` and answer a refusal as data rather than
 * throwing, so a client reads it from the result like any other outcome. The
 * author is the session's user throughout; no mutation takes one as input.
 */
export const commentMutations = {
  createComment: async (
    _parent: unknown,
    args: { input: CreateCommentInput },
    ctx: GraphQLContext,
  ): Promise<CommentWriteResult> => {
    const permission = await requireEditorEditPermission(ctx);
    if (!permission.ok) return failed(permission.error);

    try {
      return await createComment({
        client: ctx.supabase,
        entityUuid: args.input.entityUuid,
        entityType: args.input.entityType,
        content: args.input.content,
        userUuid: permission.session.userId,
      });
    } catch (error) {
      console.error('Unexpected error creating comment:', error);
      return failed(error instanceof Error ? error.message : 'Unknown error');
    }
  },

  replyToComment: async (
    _parent: unknown,
    args: { parentUuid: string; content: string },
    ctx: GraphQLContext,
  ): Promise<CommentWriteResult> => {
    const permission = await requireEditorEditPermission(ctx);
    if (!permission.ok) return failed(permission.error);

    try {
      return await replyToComment({
        client: ctx.supabase,
        parentUuid: args.parentUuid,
        content: args.content,
        userUuid: permission.session.userId,
      });
    } catch (error) {
      console.error('Unexpected error replying to comment:', error);
      return failed(error instanceof Error ? error.message : 'Unknown error');
    }
  },

  updateComment: async (
    _parent: unknown,
    args: { uuid: string; content: string },
    ctx: GraphQLContext,
  ): Promise<CommentWriteResult> => {
    const permission = await requireEditorEditPermission(ctx);
    if (!permission.ok) return failed(permission.error);

    try {
      return await updateComment({
        client: ctx.supabase,
        uuid: args.uuid,
        content: args.content,
        userUuid: permission.session.userId,
      });
    } catch (error) {
      console.error('Unexpected error updating comment:', error);
      return failed(error instanceof Error ? error.message : 'Unknown error');
    }
  },

  resolveComment: async (
    _parent: unknown,
    args: { uuid: string; resolved: boolean },
    ctx: GraphQLContext,
  ): Promise<CommentWriteResult> => {
    const permission = await requireEditorEditPermission(ctx);
    if (!permission.ok) return failed(permission.error);

    try {
      return await resolveComment({
        client: ctx.supabase,
        uuid: args.uuid,
        resolved: args.resolved,
        userUuid: permission.session.userId,
      });
    } catch (error) {
      console.error('Unexpected error resolving comment:', error);
      return failed(error instanceof Error ? error.message : 'Unknown error');
    }
  },

  setCommentTags: async (
    _parent: unknown,
    args: { uuid: string; tags: string[] },
    ctx: GraphQLContext,
  ): Promise<CommentWriteResult> => {
    const permission = await requireEditorEditPermission(ctx);
    if (!permission.ok) return failed(permission.error);

    try {
      return await setCommentTags({
        client: ctx.supabase,
        uuid: args.uuid,
        tags: args.tags,
      });
    } catch (error) {
      console.error('Unexpected error tagging comment:', error);
      return failed(error instanceof Error ? error.message : 'Unknown error');
    }
  },

  deleteComment: async (
    _parent: unknown,
    args: { uuid: string },
    ctx: GraphQLContext,
  ): Promise<CommentDeleteResult> => {
    const permission = await requireEditorEditPermission(ctx);
    if (!permission.ok) return deleteFailed(permission.error);

    try {
      return await deleteComment({
        client: ctx.supabase,
        uuid: args.uuid,
        userUuid: permission.session.userId,
      });
    } catch (error) {
      console.error('Unexpected error deleting comment:', error);
      return deleteFailed(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  },
};
