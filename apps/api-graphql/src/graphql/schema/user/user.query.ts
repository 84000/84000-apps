import type { GraphQLContext } from '../../context';

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
};
