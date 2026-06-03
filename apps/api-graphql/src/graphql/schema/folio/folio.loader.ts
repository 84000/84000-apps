import DataLoader from 'dataloader';
import {
  getFoliosByUuids,
  type DataClient,
  type Folio,
} from '@eightyfourthousand/data-access';

export function createFolioLoader(supabase: DataClient) {
  return new DataLoader<string, Folio | null>(async (folioUuids) => {
    const foliosByUuid = await getFoliosByUuids({
      client: supabase,
      uuids: folioUuids,
    });
    return folioUuids.map((uuid) => foliosByUuid.get(uuid) ?? null);
  });
}
