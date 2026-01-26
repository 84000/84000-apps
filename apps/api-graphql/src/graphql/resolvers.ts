import type { GraphQLContext } from './context';

export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),

    version: () => '1.0.0',

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
  },

  Mutation: {
    _placeholder: () => true,
  },
};
