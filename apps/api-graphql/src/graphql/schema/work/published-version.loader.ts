import DataLoader from 'dataloader';
import {
  getVersionLabelsByUuids,
  type DataClient,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for the live version label, keyed by version uuid.
 *
 * `works` carries only the pointer, so the label is one join away and a list query
 * selecting `publishedVersion` would otherwise make a round trip per work.
 */
export function createPublishedVersionLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (versionUuids) => {
    const labelsByUuid = await getVersionLabelsByUuids({
      client: supabase,
      versionUuids,
    });
    return versionUuids.map((uuid) => labelsByUuid.get(uuid) ?? null);
  });
}
