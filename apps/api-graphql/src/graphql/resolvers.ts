import type { GraphQLContext } from './context';

export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    version: () => '1.0.0',
  },
  Mutation: {
    _placeholder: () => true,
  },
};
