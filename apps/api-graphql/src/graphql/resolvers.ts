import { JSONResolver } from 'graphql-scalars';
import {
  bibliographyEntryResolver,
  workBibliographyResolver,
} from './schema/bibliography/bibliography.resolver';
import { workFoliosResolver } from './schema/folio/folio.resolver';
import {
  glossaryTermsResolver,
  glossaryEntryResolver,
  glossaryInstanceResolver,
  workGlossaryResolver,
  glossaryTermPassagesResolver,
} from './schema/glossary/glossary.resolver';
import { healthQueries } from './schema/health/health.query';
import { passageQueries } from './schema/passage/passage.query';
import { savePassagesMutation } from './schema/passage/passage.mutation';
import { userQueries } from './schema/user/user.query';
import { workQueries } from './schema/work/work.query';
import { imprintResolver } from './schema/imprint/imprint.resolver';
import { passagesResolver } from './schema/passage/passage.resolver';
import {
  passageJsonResolver,
  passageAnnotationsResolver,
  passageAlignmentsResolver,
  passageReferencesResolver,
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
    savePassages: savePassagesMutation,
  },

  Work: {
    imprint: imprintResolver,
    toc: tocResolver,
    passages: passagesResolver,
    titles: titlesResolver,
    glossary: workGlossaryResolver,
    bibliography: workBibliographyResolver,
    folios: workFoliosResolver,
  },

  GlossaryTermInstance: {
    passages: glossaryTermPassagesResolver,
  },

  Passage: {
    json: passageJsonResolver,
    annotations: passageAnnotationsResolver,
    alignments: passageAlignmentsResolver,
    references: passageReferencesResolver,
  },
};
