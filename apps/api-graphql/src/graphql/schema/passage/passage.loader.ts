import type {
  ContentSource,
  DataClient,
} from '@eightyfourthousand/data-access';
import { createAlignmentLoader } from '../alignment/alignment.loader';
import { createAnnotationLoader } from '../annotation/annotation.loader';
import { createPassageLabelLoader } from './passage-label.loader';

export function createPassageLoaders(
  supabase: DataClient,
  source: ContentSource,
) {
  return {
    annotationsByPassageUuid: createAnnotationLoader(supabase, source),
    // Alignments are deliberately unversioned — there is no
    // published_passage_alignments table, and the reader serves them from the
    // same materialized view in both sources.
    alignmentsByPassageUuid: createAlignmentLoader(supabase),
    passageLabelsByUuid: createPassageLabelLoader(supabase, source),
  };
}
