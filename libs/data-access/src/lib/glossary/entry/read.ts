import type { DataClient } from '../../types';
import { readCreatorNames, readEntries, readNamesUsedOutside } from './stored';
import type { GlossaryEntry } from './types';

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

/**
 * The names rows of an entry that are shared: also used by another entry, in
 * any work, or by a creator. A save that changes a shared name's text copies
 * it for this entry rather than editing it. `null` when the read fails.
 */
export const getGlossaryEntrySharedNames = async ({
  client,
  entry,
}: {
  client: DataClient;
  entry: GlossaryEntry;
}): Promise<Set<string> | null> => {
  const nameUuids = [...new Set(entry.names.map((n) => n.nameUuid))];
  if (!nameUuids.length) return new Set();
  try {
    const [creators, outside] = await Promise.all([
      readCreatorNames(client, nameUuids),
      readNamesUsedOutside(client, entry, nameUuids),
    ]);
    return new Set([...creators, ...outside]);
  } catch (thrown) {
    console.error(`Error reading shared names of entry ${entry.uuid}:`, thrown);
    return null;
  }
};
