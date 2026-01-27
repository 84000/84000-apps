import type { DataClient } from '@data-access';
import { createPassageLoaders } from './schema/passage/passage.loader';

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
}

export function createLoaders(supabase: DataClient): Loaders {
  return {
    ...createPassageLoaders(supabase),
  };
}
