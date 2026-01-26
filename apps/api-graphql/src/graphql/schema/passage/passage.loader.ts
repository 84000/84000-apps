import DataLoader from 'dataloader';
import type { DataClient } from '@data-access';

/**
 * Annotation row from passage_annotations table
 */
export interface AnnotationRow {
  uuid: string;
  passage_uuid: string;
  type: string;
  start: number;
  end: number;
  content: unknown[] | null;
}

export function createPassageLoaders(supabase: DataClient) {
  return {
    annotationsByPassageUuid: new DataLoader<string, AnnotationRow[]>(
      async (passageUuids) => {
        const { data, error } = await supabase
          .from('passage_annotations')
          .select('uuid, passage_uuid, type, start, end, content')
          .in('passage_uuid', passageUuids as string[]);

        if (error) {
          console.error('Error batch loading annotations:', error);
          // Return empty arrays for all keys on error
          return passageUuids.map(() => []);
        }

        // Group annotations by passage_uuid
        const annotationsByPassage = new Map<string, AnnotationRow[]>();
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
        return passageUuids.map(
          (uuid) => annotationsByPassage.get(uuid) ?? [],
        );
      },
    ),
  };
}
