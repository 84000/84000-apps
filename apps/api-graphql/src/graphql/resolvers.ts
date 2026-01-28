import { JSONResolver } from 'graphql-scalars';
import { healthQueries } from './schema/health/health.query';
import { userQueries } from './schema/user/user.query';
import { workQueries } from './schema/work/work.query';
import { imprintResolver } from './schema/imprint/imprint.resolver';
import { passagesResolver } from './schema/passage/passage.resolver';
import { passageJsonResolver } from './schema/passage/passage.field-resolver';
import { tocResolver } from './schema/toc/toc.resolver';

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
    toc: tocResolver,
    passages: passagesResolver,
  },

  Passage: {
    json: passageJsonResolver,
  },
};
