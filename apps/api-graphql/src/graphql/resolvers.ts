import { JSONResolver } from 'graphql-scalars';
import { healthQueries } from './schema/health/health.query';
import { userQueries } from './schema/user/user.query';
import { workQueries } from './schema/work/work.query';
import { imprintResolver } from './schema/imprint/imprint.resolver';
import { passagesResolver } from './schema/passage/passage.resolver';

export const resolvers = {
  JSON: JSONResolver,

  Query: {
    ...healthQueries,
    ...userQueries,
    ...workQueries,
  },

  Mutation: {
    _placeholder: () => true,
  },

  Work: {
    imprint: imprintResolver,
    passages: passagesResolver,
  },
};
