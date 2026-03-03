import type { DataClient } from '@data-access';
import { createPassageLoaders } from './schema/passage/passage.loader';
import { createGlossaryPassagesLoader } from './schema/glossary/glossary.loader';
import { createGlossaryNameLoader } from './schema/glossary/glossary-name.loader';
import { createPassageReferencesLoader } from './schema/passage/passage-references.loader';
import { createWorkTitleLoader } from './schema/work/work-title.loader';

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
   * Load passage locations for glossary term UUIDs.
   * Batches multiple glossary term passage requests into a single query.
   */
  glossaryPassagesByTermUuid: ReturnType<typeof createGlossaryPassagesLoader>;

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
}

export function createLoaders(supabase: DataClient): Loaders {
  return {
    ...createPassageLoaders(supabase),
    glossaryPassagesByTermUuid: createGlossaryPassagesLoader(supabase),
    passageReferencesByPassageUuid: createPassageReferencesLoader(supabase),
    workTitlesByUuid: createWorkTitleLoader(supabase),
    glossaryNamesByUuid: createGlossaryNameLoader(supabase),
  };
}
