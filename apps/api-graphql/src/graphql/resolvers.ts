import { JSONResolver } from 'graphql-scalars';
import {
  bibliographyEntryResolver,
  workBibliographyResolver,
} from './schema/bibliography/bibliography.resolver';
import {
  glossaryTermsResolver,
  glossaryEntryResolver,
  glossaryInstanceResolver,
  workGlossaryResolver,
} from './schema/glossary/glossary.resolver';
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
    glossaryTerms: glossaryTermsResolver,
    glossaryEntry: glossaryEntryResolver,
    glossaryInstance: glossaryInstanceResolver,
    bibliographyEntry: bibliographyEntryResolver,
  },

  Mutation: {
    _placeholder: () => true,
  },

  Work: {
    imprint: imprintResolver,
    toc: tocResolver,
    passages: passagesResolver,
    titles: titlesResolver,
    glossary: workGlossaryResolver,
    bibliography: workBibliographyResolver,
  },

  Passage: {
    json: passageJsonResolver,
    annotations: passageAnnotationsResolver,
    alignments: passageAlignmentsResolver,
  },
};
