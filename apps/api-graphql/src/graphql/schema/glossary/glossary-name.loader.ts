import DataLoader from 'dataloader';
import {
  getGlossaryDisplayNamesByUuids,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching glossary display names by UUID.
 * Joins via name_uuid to the names table to get the content.
 * Used to enrich mention annotations with display text from target glossary entries.
 */
export function createGlossaryNameLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, string | null>(async (glossaryUuids) => {
    const namesByUuid = await getGlossaryDisplayNamesByUuids({
      client: supabase,
      glossaryUuids,
      source,
    });
    return glossaryUuids.map((uuid) => namesByUuid.get(uuid) ?? null);
  });
}
