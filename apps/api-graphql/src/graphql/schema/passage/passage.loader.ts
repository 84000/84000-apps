import type { DataClient } from '@data-access';
import { createAlignmentLoader } from '../alignment/alignment.loader';
import { createAnnotationLoader } from '../annotation/annotation.loader';
import { createPassageLabelLoader } from './passage-label.loader';

export function createPassageLoaders(supabase: DataClient) {
  return {
    annotationsByPassageUuid: createAnnotationLoader(supabase),
    alignmentsByPassageUuid: createAlignmentLoader(supabase),
    passageLabelsByUuid: createPassageLabelLoader(supabase),
  };
}
