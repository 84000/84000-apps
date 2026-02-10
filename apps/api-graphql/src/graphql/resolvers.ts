import { JSONResolver } from 'graphql-scalars';
import { healthQueries } from './schema/health/health.query';
import { passageQueries } from './schema/passage/passage.query';
import { userQueries } from './schema/user/user.query';
import { workQueries } from './schema/work/work.query';
import { imprintResolver } from './schema/imprint/imprint.resolver';
import { passagesResolver } from './schema/passage/passage.resolver';
import {
  passageJsonResolver,
  passageAnnotationsResolver,
  passageAlignmentsResolver,
} from './schema/passage/passage.field-resolver';
import { tocResolver } from './schema/toc/toc.resolver';
import { titlesResolver } from './schema/work/title.resolver';

export const resolvers = {
  JSON: JSONResolver,

  Query: {
    ...healthQueries,
    ...passageQueries,
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
    titles: titlesResolver,
  },

  Passage: {
    json: passageJsonResolver,
    annotations: passageAnnotationsResolver,
    alignments: passageAlignmentsResolver,
  },
};
