import type { DataClient } from '@data-access';
import {
  createPassageLoaders,
  type AnnotationRow,
} from './schema/passage/passage.loader';

export type { AnnotationRow };

export interface Loaders {
  /**
   * Load annotations for passage UUIDs.
   * Batches multiple passage annotation requests into a single query.
   */
  annotationsByPassageUuid: ReturnType<
    typeof createPassageLoaders
  >['annotationsByPassageUuid'];
}

export function createLoaders(supabase: DataClient): Loaders {
  return {
    ...createPassageLoaders(supabase),
  };
}
