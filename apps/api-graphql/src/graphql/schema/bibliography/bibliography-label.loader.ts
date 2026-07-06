import DataLoader from 'dataloader';
import {
  getBibliographyLabelsByUuids,
  type BibliographyLabel,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching bibliography reference labels by UUID.
 * Used to enrich mention annotations with display text from target bibliography
 * entries.
 */
export function createBibliographyLabelLoader(supabase: DataClient) {
  return new DataLoader<string, BibliographyLabel | null>(async (uuids) => {
    const labelsByUuid = await getBibliographyLabelsByUuids({
      client: supabase,
      uuids,
    });
    return uuids.map((uuid) => labelsByUuid.get(uuid) ?? null);
  });
}
