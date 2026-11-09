import DataLoader from 'dataloader';
import {
  getPassageLocationsByUuids,
  type ContentSource,
  type DataClient,
  type PassageLocation,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching each passage's section type and Toh
 * scope by UUID.
 */
export function createPassageLocationLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, PassageLocation | null>(
    async (passageUuids) => {
      const locationsByUuid = await getPassageLocationsByUuids({
        client: supabase,
        passageUuids,
        source,
      });
      return passageUuids.map((uuid) => locationsByUuid.get(uuid) ?? null);
    },
  );
}
