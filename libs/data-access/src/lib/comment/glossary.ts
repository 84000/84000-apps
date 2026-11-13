import type { DataClient } from '../types';
import { getGlossaryEntries } from '../glossary/entry/read';
import type { GlossaryEntry } from '../glossary/entry/types';
import { inBatches } from '../passage/in-batches';

/** Rows per request. PostgREST truncates a read at 1000 without an error. */
const PAGE_ROWS = 1000;

/**
 * The glossary entries of a work that carry comment threads.
 *
 * A comment reaches its entry through `entity_uuid`, which is not a foreign
 * key, so the work cannot be asked for its comments directly. Comments on
 * glossary entries are few, so this reads which entries have a thread, across
 * every work, and keeps the ones that belong to this work. Entries come back as
 * `getGlossaryEntries` reads them, so a thread whose entry was deleted drops
 * out, as does one on another work's entry. Null when a read fails.
 */
export const getGlossaryCommentEntries = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<GlossaryEntry[] | null> => {
  const commented = new Set<string>();

  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await client
      .from('comments')
      .select('entity_uuid')
      .eq('entity_type', 'glossary')
      .is('parent_uuid', null)
      // A total order, or pages can skip and repeat rows.
      .order('entity_uuid')
      .order('uuid')
      .range(from, from + PAGE_ROWS - 1);

    if (error) {
      console.error('Error reading glossary comment entries:', error);
      return null;
    }

    const rows = (data ?? []) as { entity_uuid: string }[];
    rows.forEach(({ entity_uuid }) => commented.add(entity_uuid));
    if (rows.length < PAGE_ROWS) break;
  }

  const entries: GlossaryEntry[] = [];
  for (const uuids of inBatches([...commented])) {
    const read = await getGlossaryEntries({ client, workUuid, uuids });
    if (!read) return null;
    entries.push(...read);
  }

  return entries;
};
