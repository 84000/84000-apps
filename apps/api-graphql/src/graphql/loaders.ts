import type {
  ContentSource,
  DataClient,
} from '@eightyfourthousand/data-access';
import { createPassageLoaders } from './schema/passage/passage.loader';
import { createGlossaryNameLoader } from './schema/glossary/glossary-name.loader';
import { createGlossaryPassagesLoader } from './schema/glossary/glossary-passages.loader';
import { createPassageReferencesLoader } from './schema/passage/passage-references.loader';
import { createWorkTitleLoader } from './schema/work/work-title.loader';
import { createFolioLoader } from './schema/folio/folio.loader';
import { createBibliographyLabelLoader } from './schema/bibliography/bibliography-label.loader';
import { createImprintLoader } from './schema/imprint/imprint.loader';
import { createPublishedVersionLoader } from './schema/work/published-version.loader';

export interface Loaders {
  /**
   * Load annotations for passage UUIDs.
   * Batches multiple passage annotation requests into a single query.
   */
  annotationsByPassageUuid: ReturnType<
    typeof createPassageLoaders
  >['annotationsByPassageUuid'];

  /**
   * Load alignments for passage UUIDs.
   * Batches multiple passage alignment requests into a single query.
   */
  alignmentsByPassageUuid: ReturnType<
    typeof createPassageLoaders
  >['alignmentsByPassageUuid'];

  /**
   * Load passage labels by UUID.
   * Used to enrich endNoteLink annotations with labels from target passages.
   */
  passageLabelsByUuid: ReturnType<
    typeof createPassageLoaders
  >['passageLabelsByUuid'];

  /**
   * Load passages that reference a given endnote passage UUID via end-note-link annotations.
   */
  passageReferencesByPassageUuid: ReturnType<
    typeof createPassageReferencesLoader
  >;

  /**
   * Load work titles by UUID.
   * Used to enrich mention annotations with display text from target works.
   */
  workTitlesByUuid: ReturnType<typeof createWorkTitleLoader>;

  /**
   * Load glossary display names by UUID.
   * Used to enrich mention annotations with display text from target glossary entries.
   */
  glossaryNamesByUuid: ReturnType<typeof createGlossaryNameLoader>;

  /**
   * Load a page of citing passages per glossary term.
   * A glossary page resolves this once per term; batching collapses the whole
   * page into one call.
   */
  glossaryPassagesByTerm: ReturnType<typeof createGlossaryPassagesLoader>;

  /**
   * Load folios by UUID.
   * Used to enrich mention annotations with display text from target folios.
   */
  foliosByUuid: ReturnType<typeof createFolioLoader>;

  /**
   * Load bibliography reference labels by UUID.
   * Used to enrich mention annotations with display text from target
   * bibliography entries.
   */
  bibliographyLabelsByUuid: ReturnType<typeof createBibliographyLabelLoader>;

  /**
   * Load imprints by (work uuid, toh) pair.
   * Batches the per-work imprint RPC into a single query for list results.
   */
  imprintsByWorkToh: ReturnType<typeof createImprintLoader>;

  /**
   * Load the live version label by version uuid.
   * Used by Work.publishedVersion, which has only the pointer to work from.
   */
  publishedVersionsByUuid: ReturnType<typeof createPublishedVersionLoader>;
}

/**
 * The request's loaders, all reading the one source the request asked for.
 *
 * A DataLoader caches by key alone, so a set can only ever serve one source —
 * the same passage UUID means a different row in each. That is fine here
 * because the source is fixed for the whole request.
 */
export function createLoaders(
  supabase: DataClient,
  source: ContentSource,
): Loaders {
  return {
    ...createPassageLoaders(supabase, source),
    passageReferencesByPassageUuid: createPassageReferencesLoader(
      supabase,
      source,
    ),
    workTitlesByUuid: createWorkTitleLoader(supabase),
    glossaryNamesByUuid: createGlossaryNameLoader(supabase, source),
    glossaryPassagesByTerm: createGlossaryPassagesLoader(supabase, source),
    foliosByUuid: createFolioLoader(supabase),
    bibliographyLabelsByUuid: createBibliographyLabelLoader(supabase, source),
    imprintsByWorkToh: createImprintLoader(supabase),
    publishedVersionsByUuid: createPublishedVersionLoader(supabase),
  };
}
