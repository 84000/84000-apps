import type { GraphQLClient } from 'graphql-request';
import {
  getTranslationBlocks,
  RequestNotSentError,
} from '@eightyfourthousand/client-graphql';
import {
  createBrowserClient,
  getPassageSorts,
} from '@eightyfourthousand/data-access';
import type { UnconfirmedSave } from './editor-context';

/** The parts of a graphql-request `ClientError` this module reads. */
type ClientErrorShape = {
  response: { status: number; errors?: { path?: unknown[] }[] };
};

const isClientError = (error: unknown): error is ClientErrorShape =>
  typeof error === 'object' &&
  error !== null &&
  'response' in error &&
  typeof (error as ClientErrorShape).response?.status === 'number';

/**
 * Whether a save request that threw may still have been applied. Only a
 * request that was never sent, or that the server refused before running it
 * (a 4xx, or a GraphQL error without a `path`), is known to have written
 * nothing.
 */
export const mayHaveBeenApplied = (error: unknown): boolean => {
  if (error instanceof RequestNotSentError) return false;
  if (!isClientError(error)) return true;
  const { status, errors } = error.response;
  if (status >= 500) return true;
  // A 4xx without a resolver error (one with a `path`) was refused before it ran.
  return (errors ?? []).some((e) => (e.path?.length ?? 0) > 0);
};

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

/**
 * Whether the editors can read the work again right now, through the API and
 * reader they load it with. Checked before a reload discards what they hold.
 */
export const canReload = async (
  graphql: GraphQLClient,
  workUuid: string,
): Promise<boolean> => {
  const page = await getTranslationBlocks({
    client: graphql,
    uuid: workUuid,
    maxPassages: 1,
  });
  return !page.failed;
};
