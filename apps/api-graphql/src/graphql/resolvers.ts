import { JSONResolver } from 'graphql-scalars';
import {
  bibliographyEntryResolver,
  workBibliographyResolver,
} from './schema/bibliography/bibliography.resolver';
import {
  workFoliosResolver,
  workFoliosAroundResolver,
} from './schema/folio/folio.resolver';
import {
  glossaryInstanceResolver,
  workGlossaryResolver,
  workGlossaryTermsResolver,
  searchWorkGlossaryTermsResolver,
  glossaryTermPassagesResolver,
  glossaryTermPassagesPageResolver,
} from './schema/glossary/glossary.resolver';
import { healthQueries } from './schema/health/health.query';
import { lookupQueries } from './schema/lookup/lookup.query';
import {
  importMutations,
  importQueries,
} from './schema/import/import.resolver';
import { passageQueries } from './schema/passage/passage.query';
import {
  replaceMutation,
  savePassagesMutation,
} from './schema/passage/passage.mutation';
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
import { searchResolver } from './schema/search/search.resolver';

export const resolvers = {
  JSON: JSONResolver,

  Query: {
    ...healthQueries,
    ...lookupQueries,
    ...importQueries,
    ...passageQueries,
    ...userQueries,
    ...workQueries,
    glossaryInstance: glossaryInstanceResolver,
    glossaryTermPassages: glossaryTermPassagesPageResolver,
    bibliographyEntry: bibliographyEntryResolver,
    search: searchResolver,
  },

  Mutation: {
    replace: replaceMutation,
    savePassages: savePassagesMutation,
    ...importMutations,
  },

  Work: {
    imprint: imprintResolver,
    toc: tocResolver,
    passages: passagesResolver,
    titles: titlesResolver,
    glossary: workGlossaryResolver,
    glossaryTerms: workGlossaryTermsResolver,
    searchGlossaryTerms: searchWorkGlossaryTermsResolver,
    bibliography: workBibliographyResolver,
    folios: workFoliosResolver,
    foliosAround: workFoliosAroundResolver,
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
