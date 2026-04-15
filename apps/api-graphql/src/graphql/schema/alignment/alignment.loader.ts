import DataLoader from 'dataloader';
import {
  getAlignmentsByPassageUuids,
  type AlignmentDTO,
  type DataClient,
} from '@eightyfourthousand/data-access';

export function createAlignmentLoader(supabase: DataClient) {
  return new DataLoader<string, AlignmentDTO[]>(async (passageUuids) => {
    const alignmentsByPassage = await getAlignmentsByPassageUuids({
      client: supabase,
      passageUuids,
    });
    return passageUuids.map((uuid) => alignmentsByPassage.get(uuid) ?? []);
  });
}
