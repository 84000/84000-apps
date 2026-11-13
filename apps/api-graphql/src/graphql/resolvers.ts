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
  glossaryTermExcerptsResolver,
  glossaryTermInstancesResolver,
} from './schema/glossary/glossary.resolver';
import { removeGlossaryTermInstancesMutation } from './schema/glossary/glossary.mutation';
import { healthQueries } from './schema/health/health.query';
import { lookupQueries } from './schema/lookup/lookup.query';
import { passageQueries } from './schema/passage/passage.query';
import { publishMutations } from './schema/publish/publish.mutation';
import { publishQueries } from './schema/publish/publish.query';
import {
  snapshotBundleMutations,
  snapshotBundleQueries,
} from './schema/snapshot/bundle.resolver';
import { etextsQueries } from './schema/snapshot/etexts.query';
import {
  snapshotMutations,
  workSnapshotResolvers,
} from './schema/snapshot/snapshot.mutation';
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
  passageContentLengthResolver,
  passageAnnotationsResolver,
  passageAlignmentsResolver,
  passageReferencesResolver,
} from './schema/passage/passage.field-resolver';
import { tocResolver } from './schema/toc/toc.resolver';
import { titlesResolver } from './schema/work/title.resolver';
import { publishedVersionResolver } from './schema/work/published-version.resolver';
import {
  entitySearchResultResolvers,
  searchResolver,
} from './schema/search/search.resolver';
import {
  passageCommentsResolver,
  passageUnanchoredCommentsResolver,
  commentAuthorResolver,
  commentQueryResolver,
  commentRepliesResolver,
  commentReplyCountResolver,
  commentResolvedByResolver,
  taggedCommentsQueryResolver,
  taggedCommentWorksQueryResolver,
  workBibliographyCommentsResolver,
  workGlossaryCommentsResolver,
} from './schema/comment/comment.resolver';
import { commentMutations } from './schema/comment/comment.mutation';

export const resolvers = {
  JSON: JSONResolver,

  Query: {
    ...etextsQueries,
    ...healthQueries,
    ...lookupQueries,
    ...passageQueries,
    ...publishQueries,
    ...snapshotBundleQueries,
    ...userQueries,
    ...workQueries,
    glossaryInstance: glossaryInstanceResolver,
    glossaryTermPassages: glossaryTermPassagesPageResolver,
    glossaryTermExcerpts: glossaryTermExcerptsResolver,
    glossaryTermInstances: glossaryTermInstancesResolver,
    bibliographyEntry: bibliographyEntryResolver,
    comment: commentQueryResolver,
    taggedComments: taggedCommentsQueryResolver,
    taggedCommentWorks: taggedCommentWorksQueryResolver,
    search: searchResolver,
  },

  Mutation: {
    ...commentMutations,
    ...publishMutations,
    ...snapshotBundleMutations,
    ...snapshotMutations,
    replace: replaceMutation,
    savePassages: savePassagesMutation,
    removeGlossaryTermInstances: removeGlossaryTermInstancesMutation,
  },

  EntitySearchResult: entitySearchResultResolvers,

  Work: {
    imprint: imprintResolver,
    toc: tocResolver,
    passages: passagesResolver,
    titles: titlesResolver,
    publishedVersion: publishedVersionResolver,
    glossary: workGlossaryResolver,
    glossaryTerms: workGlossaryTermsResolver,
    searchGlossaryTerms: searchWorkGlossaryTermsResolver,
    bibliography: workBibliographyResolver,
    bibliographyComments: workBibliographyCommentsResolver,
    glossaryComments: workGlossaryCommentsResolver,
    folios: workFoliosResolver,
    foliosAround: workFoliosAroundResolver,
  },

  GlossaryTermInstance: {
    passages: glossaryTermPassagesResolver,
  },

  Passage: {
    json: passageJsonResolver,
    contentLength: passageContentLengthResolver,
    annotations: passageAnnotationsResolver,
    alignments: passageAlignmentsResolver,
    references: passageReferencesResolver,
    comments: passageCommentsResolver,
    unanchoredComments: passageUnanchoredCommentsResolver,
  },

  WorkSnapshot: workSnapshotResolvers,

  Comment: {
    author: commentAuthorResolver,
    resolvedBy: commentResolvedByResolver,
    replies: commentRepliesResolver,
    replyCount: commentReplyCountResolver,
  },
};
