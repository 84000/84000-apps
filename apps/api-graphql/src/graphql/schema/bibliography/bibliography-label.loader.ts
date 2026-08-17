import DataLoader from 'dataloader';
import {
  getBibliographyLabelsByUuids,
  type BibliographyLabel,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching bibliography reference labels by UUID.
 * Used to enrich mention annotations with display text from target bibliography
 * entries.
 */
export function createBibliographyLabelLoader(
  supabase: DataClient,
  source: ContentSource,
) {
  return new DataLoader<string, BibliographyLabel | null>(async (uuids) => {
    const labelsByUuid = await getBibliographyLabelsByUuids({
      client: supabase,
      uuids,
      source,
    });
    return uuids.map((uuid) => labelsByUuid.get(uuid) ?? null);
  });
}
