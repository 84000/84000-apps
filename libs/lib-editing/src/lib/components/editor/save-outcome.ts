import type { GraphQLClient } from 'graphql-request';
import { findWorkPassages } from '@eightyfourthousand/client-graphql';
import {
  createBrowserClient,
  getPassageSorts,
  getWorkPassageUuids,
} from '@eightyfourthousand/data-access';
import type { UnconfirmedSave } from './editor-context';

/** The stored passages among `uuids`, or null when they cannot be read. */
export const readStored = async (
  uuids: string[],
): Promise<Set<string> | null> => {
  try {
    const sorts = await getPassageSorts({
      client: createBrowserClient(),
      uuids,
    });
    return sorts && new Set(sorts.keys());
  } catch (error) {
    console.error('Could not read the saved passages:', error);
    return null;
  }
};

/** What the stored passages say about a save whose answer was lost. */
export type SaveVerdict = 'applied' | 'not-applied' | 'undecided';

/**
 * Whether a save whose answer was lost was applied, from what is stored now.
 * The save is all or nothing, so one passage can settle it: a sent passage
 * missing, or a deleted one still there, means it was not; a new passage
 * stored, or a deleted one gone, means it was. A save that only changed
 * content leaves no such trace.
 */
export const judgeSave = (
  stored: Set<string>,
  { sent, inserted, deleted }: UnconfirmedSave,
): SaveVerdict => {
  if (
    sent.some((uuid) => !stored.has(uuid)) ||
    deleted.some((uuid) => stored.has(uuid))
  ) {
    return 'not-applied';
  }
  return inserted.length || deleted.length ? 'applied' : 'undecided';
};

/** The most passages a probe asks for, a page. */
const PROBE_LIMIT = 100;

/**
 * Whether the editors can read the work again right now, through the API they
 * load it with: passages known to be stored come back. Knowing none, one is
 * read from the database, whose reads report failure; a work with none there
 * can be read empty. Checked before a reload discards what they hold.
 */
export const canReload = async (
  graphql: GraphQLClient,
  workUuid: string,
  stored: string[],
): Promise<boolean> => {
  const uuids = stored.length
    ? stored.slice(0, PROBE_LIMIT)
    : await getWorkPassageUuids({
        client: createBrowserClient(),
        workUuid,
        limit: 1,
      }).catch((error: unknown) => {
        console.error('Could not read the work:', error);
        return null;
      });
  if (!uuids) return false;
  const found = await findWorkPassages({
    client: graphql,
    uuid: workUuid,
    uuids,
  });
  return !!found && uuids.every((uuid) => found.has(uuid));
};
