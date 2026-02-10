import type { GraphQLContext } from '../../context';

/**
 * Map GraphQL Permission enum to Supabase permission strings
 */
const permissionMap: Record<string, string> = {
  PROJECTS_READ: 'projects.read',
  PROJECTS_EDIT: 'projects.edit',
  PROJECTS_ADMIN: 'projects.admin',
  EDITOR_READ: 'editor.read',
  EDITOR_EDIT: 'editor.edit',
  EDITOR_ADMIN: 'editor.admin',
};

export const userQueries = {
  me: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    if (!ctx.session) {
      return null;
    }

    return {
      id: ctx.session.userId,
      email: ctx.session.email,
      role: ctx.session.claims.role.toUpperCase(),
    };
  },

  hasPermission: async (
    _parent: unknown,
    args: { permission: string },
    ctx: GraphQLContext,
  ): Promise<boolean> => {
    if (!ctx.session) {
      return false;
    }

    const supabasePermission = permissionMap[args.permission];
    if (!supabasePermission) {
      console.error(`Unknown permission: ${args.permission}`);
      return false;
    }

    const { data, error } = await ctx.supabase.rpc('authorize', {
      requested_permission: supabasePermission,
    });

    if (error) {
      console.error(`Failed to check permission: ${error.message}`);
      return false;
    }

    return data as boolean;
  },
};
