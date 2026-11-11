import type { DataClient } from '../../types';
import {
  glossaryEntryFromDTO,
  type GlossaryEntry,
  type GlossaryEntryDTO,
} from './types';

type EntriesRead =
  | { ok: true; entries: GlossaryEntry[] }
  | { ok: false; error: string };

const readEntries = async (
  client: DataClient,
  workUuid: string,
  uuids: readonly string[],
): Promise<EntriesRead> => {
  try {
    const { data, error } = await client.rpc('read_glossary_entries', {
      p_work_uuid: workUuid,
      p_uuids: uuids,
    });
    if (error) {
      console.error(
        `Error reading glossary entries of work ${workUuid}:`,
        error,
      );
      return { ok: false, error: error.message };
    }
    return {
      ok: true,
      entries: ((data ?? []) as GlossaryEntryDTO[]).map(glossaryEntryFromDTO),
    };
  } catch (thrown) {
    console.error(
      `Error reading glossary entries of work ${workUuid}:`,
      thrown,
    );
    return {
      ok: false,
      error: thrown instanceof Error ? thrown.message : String(thrown),
    };
  }
};

/**
 * Entries of one work by uuid, in `uuids` order. A uuid that is not an entry
 * of the work is left out. `null` when the read fails.
 */
export const getGlossaryEntries = async ({
  client,
  workUuid,
  uuids,
}: {
  client: DataClient;
  workUuid: string;
  uuids: readonly string[];
}): Promise<GlossaryEntry[] | null> => {
  if (uuids.length === 0) return [];
  const read = await readEntries(client, workUuid, uuids);
  return read.ok ? read.entries : null;
};

export type GlossaryEntryRead =
  | { status: 'found'; entry: GlossaryEntry }
  | { status: 'not-found' }
  | { status: 'failed'; error: string };

/** One entry of a work, telling a missing entry apart from a failed read. */
export const getGlossaryEntry = async ({
  client,
  workUuid,
  uuid,
}: {
  client: DataClient;
  workUuid: string;
  uuid: string;
}): Promise<GlossaryEntryRead> => {
  const read = await readEntries(client, workUuid, [uuid]);
  if (!read.ok) return { status: 'failed', error: read.error };
  const [entry] = read.entries;
  return entry ? { status: 'found', entry } : { status: 'not-found' };
};
