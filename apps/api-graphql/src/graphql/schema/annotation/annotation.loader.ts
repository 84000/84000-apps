import DataLoader from 'dataloader';
import type { AnnotationDTO, DataClient } from '@data-access';

export function createAnnotationLoader(supabase: DataClient) {
  return new DataLoader<string, AnnotationDTO[]>(async (passageUuids) => {
    // Supabase defaults to 1000 row limit. Paginate to ensure all annotations are fetched.
    const PAGE_SIZE = 1000;
    let allData: AnnotationDTO[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('passage_annotations')
        .select('uuid, passage_uuid, type, start, end, content')
        .in('passage_uuid', passageUuids as string[])
        .not('type', 'like', 'deprecated%')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Error batch loading annotations:', error);
        // Return empty arrays for all keys on error
        return passageUuids.map(() => []);
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    // Group annotations by passage_uuid
    const annotationsByPassage = new Map<string, AnnotationDTO[]>();
    for (const annotation of allData) {
      const passageUuid = annotation.passage_uuid;
      if (!passageUuid) continue;
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
