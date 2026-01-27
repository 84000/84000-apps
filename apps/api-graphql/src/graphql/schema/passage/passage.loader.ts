import type { DataClient } from '@data-access';
import { createAlignmentLoader } from '../alignment/alignment.loader';
import { createAnnotationLoader } from '../annotation/annotation.loader';

export function createPassageLoaders(supabase: DataClient) {
  return {
    annotationsByPassageUuid: createAnnotationLoader(supabase),
    alignmentsByPassageUuid: createAlignmentLoader(supabase),
  };
}
