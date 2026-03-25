import DataLoader from 'dataloader';
import type { DataClient } from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for batch-fetching glossary display names by UUID.
 * Joins via name_uuid to the names table to get the content.
 * Used to enrich mention annotations with display text from target glossary entries.
 */
export function createGlossaryNameLoader(supabase: DataClient) {
  return new DataLoader<string, string | null>(async (glossaryUuids) => {
    const { data, error } = await supabase
      .from('glossaries')
      .select('uuid, names:names!name_uuid(content)')
      .in('uuid', glossaryUuids as string[]);

    if (error) {
      console.error('Error batch loading glossary names:', error);
      return glossaryUuids.map(() => null);
    }

    const namesByUuid = new Map<string, string>();
    for (const glossary of data ?? []) {
      // Supabase returns the joined row; cast through unknown since the
      // generated types may represent it as an array or object depending on
      // the FK cardinality inference.
      const names = glossary.names as unknown as
        | { content: string }
        | { content: string }[]
        | null;
      const content = Array.isArray(names)
        ? names[0]?.content
        : names?.content;
      if (content) {
        namesByUuid.set(glossary.uuid, content);
      }
    }

    return glossaryUuids.map((uuid) => namesByUuid.get(uuid) ?? null);
  });
}
