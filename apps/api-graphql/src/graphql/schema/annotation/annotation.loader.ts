import DataLoader from 'dataloader';
import type { AnnotationDTO, DataClient } from '@data-access';

export function createAnnotationLoader(supabase: DataClient) {
  return new DataLoader<string, AnnotationDTO[]>(async (passageUuids) => {
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

    // Sort each group by start ascending, then end descending
    for (const annotations of annotationsByPassage.values()) {
      annotations.sort((a, b) => {
        if (a.start !== b.start) {
          return a.start - b.start;
        }
        return b.end - a.end;
      });
    }

    // Return in same order as input keys
    return passageUuids.map((uuid) => annotationsByPassage.get(uuid) ?? []);
  });
}
