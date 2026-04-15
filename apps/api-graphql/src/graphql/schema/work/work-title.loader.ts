import DataLoader from 'dataloader';
import {
  getWorkTitlesByUuids,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching work titles by UUID.
 * Used to enrich mention annotations with display text from target works.
 */
export function createWorkTitleLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (workUuids) => {
    const titlesByUuid = await getWorkTitlesByUuids({
      client: supabase,
      uuids: workUuids,
    });
    return workUuids.map((uuid) => titlesByUuid.get(uuid) ?? null);
  });
}
