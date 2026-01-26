import DataLoader from 'dataloader';
import type { DataClient } from '@data-access';

/**
 * DataLoader factory for batching and caching database queries.
 *
 * Phase 1: Scaffolding for future use.
 * The imprint and passages fields are typically accessed on single-work queries,
 * so N+1 prevention isn't critical yet. This infrastructure will be used for
 * future fields like titles and creators that need batching on list queries.
 */
export interface Loaders {
  // Future loaders will be added here as needed
  // e.g., titlesByWorkUuid: DataLoader<string, Title[]>;
  // e.g., creatorsByWorkUuid: DataLoader<string, Creator[]>;
}

export function createLoaders(_supabase: DataClient): Loaders {
  // Loaders will be created here as needed
  // Example pattern for future use:
  //
  // titlesByWorkUuid: new DataLoader(async (workUuids) => {
  //   const { data } = await supabase
  //     .from('titles')
  //     .select('*')
  //     .in('work_uuid', workUuids as string[]);
  //
  //   // Group by work_uuid and return in same order as input
  //   return workUuids.map(uuid =>
  //     data?.filter(t => t.work_uuid === uuid) ?? []
  //   );
  // }),

  return {};
}
