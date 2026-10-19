import type { DataClient } from '../types';

/**
 * How many passage annotations point at a bibliography row, as a mention of
 * it does. `null` when they cannot be counted.
 */
export const countBibliographyReferences = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<number | null> => {
  try {
    const { count, error } = await client
      .from('passage_annotations')
      .select('uuid', { count: 'exact', head: true })
      .contains('content', [{ uuid }]);
    if (error) {
      console.error(`Error counting references to ${uuid}:`, error);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.error(`Error counting references to ${uuid}:`, error);
    return null;
  }
};
