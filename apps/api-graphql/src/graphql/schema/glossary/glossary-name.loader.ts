import DataLoader from 'dataloader';
import {
  getGlossaryDisplayNamesByUuids,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching glossary display names by UUID.
 * Joins via name_uuid to the names table to get the content.
 * Used to enrich mention annotations with display text from target glossary entries.
 */
export function createGlossaryNameLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (glossaryUuids) => {
    const namesByUuid = await getGlossaryDisplayNamesByUuids({
      client: supabase,
      glossaryUuids,
    });
    return glossaryUuids.map((uuid) => namesByUuid.get(uuid) ?? null);
  });
}
