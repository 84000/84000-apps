import DataLoader from 'dataloader';
import type { AlignmentDTO, AnnotationDTO, DataClient } from '@data-access';

export function createPassageLoaders(supabase: DataClient) {
  return {
    annotationsByPassageUuid: new DataLoader<string, AnnotationDTO[]>(
      async (passageUuids) => {
        const { data, error } = await supabase
          .from('passage_annotations')
          .select('uuid, passage_uuid, type, start, end, content')
          .in('passage_uuid', passageUuids as string[])
          .not('type', 'like', 'deprecated%');

        if (error) {
          console.error('Error batch loading annotations:', error);
          // Return empty arrays for all keys on error
          return passageUuids.map(() => []);
        }

        // Group annotations by passage_uuid
        const annotationsByPassage = new Map<string, AnnotationDTO[]>();
        for (const annotation of data ?? []) {
          const passageUuid = annotation.passage_uuid;
          const existing = annotationsByPassage.get(passageUuid);
          if (existing) {
            existing.push(annotation);
          } else {
            annotationsByPassage.set(passageUuid, [annotation]);
          }
        }

        // Return in same order as input keys
        return passageUuids.map((uuid) => annotationsByPassage.get(uuid) ?? []);
      },
    ),

    alignmentsByPassageUuid: new DataLoader<string, AlignmentDTO[]>(
      async (passageUuids) => {
        const { data, error } = await supabase
          .from('passage_alignments')
          .select(
            'passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number',
          )
          .in('passage_uuid', passageUuids as string[]);

        if (error) {
          console.error('Error batch loading alignments:', error);
          // Return empty arrays for all keys on error
          return passageUuids.map(() => []);
        }

        const dtos = (data ?? []) as AlignmentDTO[];

        // Group alignments by passage_uuid
        const alignmentsByPassage = new Map<string, AlignmentDTO[]>();
        for (const dto of dtos ?? []) {
          const passageUuid = dto.passage_uuid;
          const existing = alignmentsByPassage.get(passageUuid);
          if (existing) {
            existing.push(dto);
          } else {
            alignmentsByPassage.set(passageUuid, [dto]);
          }
        }

        // Return in same order as input keys
        return passageUuids.map((uuid) => alignmentsByPassage.get(uuid) ?? []);
      },
    ),
  };
}
