import DataLoader from 'dataloader';
import {
  getPassageLabelsByUuids,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching passage labels by UUID.
 * Used to enrich endNoteLink annotations with labels from target passages.
 */
export function createPassageLabelLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (passageUuids) => {
    const labelsByUuid = await getPassageLabelsByUuids({
      client: supabase,
      passageUuids,
    });
    return passageUuids.map((uuid) => labelsByUuid.get(uuid) ?? null);
  });
}
