import DataLoader from 'dataloader';
import type { DataClient } from '@data-access';

/**
 * Creates a DataLoader for batch-fetching work titles by UUID.
 * Used to enrich mention annotations with display text from target works.
 */
export function createWorkTitleLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (workUuids) => {
    const { data, error } = await supabase
      .from('works')
      .select('uuid, title')
      .in('uuid', workUuids as string[]);

    if (error) {
      console.error('Error batch loading work titles:', error);
      return workUuids.map(() => null);
    }

    const titlesByUuid = new Map<string, string>();
    for (const work of data ?? []) {
      if (work.title) {
        titlesByUuid.set(work.uuid, work.title);
      }
    }

    return workUuids.map((uuid) => titlesByUuid.get(uuid) ?? null);
  });
}
