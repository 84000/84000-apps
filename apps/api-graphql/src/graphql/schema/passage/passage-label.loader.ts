import DataLoader from 'dataloader';
import type { DataClient } from '@data-access';

/**
 * Creates a DataLoader for batch-fetching passage labels by UUID.
 * Used to enrich endNoteLink annotations with labels from target passages.
 */
export function createPassageLabelLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (passageUuids) => {
    const { data, error } = await supabase
      .from('passages')
      .select('uuid, label')
      .in('uuid', passageUuids as string[]);

    if (error) {
      console.error('Error batch loading passage labels:', error);
      // Return null for all keys on error
      return passageUuids.map(() => null);
    }

    // Create a map for O(1) lookup
    const labelsByUuid = new Map<string, string>();
    for (const passage of data ?? []) {
      if (passage.label) {
        labelsByUuid.set(passage.uuid, passage.label);
      }
    }

    // Return in same order as input keys
    return passageUuids.map((uuid) => labelsByUuid.get(uuid) ?? null);
  });
}
