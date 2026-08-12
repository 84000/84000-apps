import DataLoader from 'dataloader';
import {
  getAnnotationsByPassageUuids,
  type AnnotationDTO,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';

export function createAnnotationLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, AnnotationDTO[]>(async (passageUuids) => {
    const annotationsByPassage = await getAnnotationsByPassageUuids({
      client: supabase,
      passageUuids,
      source,
    });
    return passageUuids.map((uuid) => annotationsByPassage.get(uuid) ?? []);
  });
}
