import type { DataClient } from '@data-access';
import { createPassageLoaders } from './schema/passage/passage.loader';
import { createGlossaryPassagesLoader } from './schema/glossary/glossary.loader';

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
}

export function createLoaders(supabase: DataClient): Loaders {
  return {
    ...createPassageLoaders(supabase),
    glossaryPassagesByTermUuid: createGlossaryPassagesLoader(supabase),
  };
}
