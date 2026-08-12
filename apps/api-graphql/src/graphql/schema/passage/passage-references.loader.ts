import DataLoader from 'dataloader';
import {
  getPassageReferencesByTargetUuids,
  type ContentSource,
  type DataClient,
  type Passages,
} from '@eightyfourthousand/data-access';

export function createPassageReferencesLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, Passages>(
    async (passageUuids) => {
      const referencesByTargetUuid = await getPassageReferencesByTargetUuids({
        client: supabase,
        passageUuids,
        source,
      });
      return passageUuids.map((uuid) => referencesByTargetUuid.get(uuid) ?? []);
    },
  );
}
