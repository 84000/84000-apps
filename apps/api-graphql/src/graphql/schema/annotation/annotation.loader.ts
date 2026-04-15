import DataLoader from 'dataloader';
import {
  getAnnotationsByPassageUuids,
  type AnnotationDTO,
  type DataClient,
} from '@eightyfourthousand/data-access';

export function createAnnotationLoader(supabase: DataClient) {
  return new DataLoader<string, AnnotationDTO[]>(async (passageUuids) => {
    const annotationsByPassage = await getAnnotationsByPassageUuids({
      client: supabase,
      passageUuids,
    });
    return passageUuids.map((uuid) => annotationsByPassage.get(uuid) ?? []);
  });
}
