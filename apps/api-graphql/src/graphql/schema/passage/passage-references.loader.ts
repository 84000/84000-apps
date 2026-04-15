import DataLoader from 'dataloader';
import {
  getPassageReferencesByTargetUuids,
  type DataClient,
  type Passages,
} from '@eightyfourthousand/data-access';

export function createPassageReferencesLoader(supabase: DataClient) {
  return new DataLoader<string, Passages>(
    async (passageUuids) => {
      const referencesByTargetUuid = await getPassageReferencesByTargetUuids({
        client: supabase,
        passageUuids,
      });
      return passageUuids.map((uuid) => referencesByTargetUuid.get(uuid) ?? []);
    },
  );
}
