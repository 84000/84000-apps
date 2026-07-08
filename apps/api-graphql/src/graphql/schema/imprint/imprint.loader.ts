import DataLoader from 'dataloader';
import {
  getTranslationImprints,
  imprintKey,
  type DataClient,
  type Imprint,
  type ImprintKey,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching imprints by (work uuid, toh) pair.
 * Collapses the per-work `get_imprint` RPC into a single `get_imprints` call
 * per request, so list queries that select `imprint` avoid N+1 round-trips.
 */
export function createImprintLoader(supabase: DataClient) {
  return new DataLoader<ImprintKey, Imprint | null, string>(
    async (keys) => {
      const imprintsByKey = await getTranslationImprints({
        client: supabase,
        keys,
      });
      return keys.map((key) => imprintsByKey.get(imprintKey(key)) ?? null);
    },
    { cacheKeyFn: imprintKey },
  );
}
