import type { GraphQLClient } from 'graphql-request';
import {
  createBrowserClient,
  getPassageSorts,
} from '@eightyfourthousand/data-access';

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
 * Whether a save request that threw after it was sent may still have been
 * applied. Only a request the server refused before running it (a 4xx, or a
 * GraphQL error without a `path`) is known to have written nothing.
 */
export const mayHaveBeenApplied = (error: unknown): boolean => {
  if (!isClientError(error)) return true;
  const { status, errors } = error.response;
  if (status >= 500) return true;
  // A 4xx means the request was refused before it ran.
  return (errors ?? []).some((e) => (e.path?.length ?? 0) > 0);
};

/**
 * Read back the passages a save with an unknown outcome touched, and check
 * the API the editors reload through answers. False when either cannot be
 * reached.
 */
export const readBackSaved = async (
  graphql: GraphQLClient,
  uuids: string[],
): Promise<boolean> => {
  try {
    const sorts = await getPassageSorts({
      client: createBrowserClient(),
      uuids,
    });
    if (sorts === null) return false;
    // Throws when the API cannot be reached, where its readers return empty.
    await graphql.request('query SaveOutcomeCheck { __typename }');
    return true;
  } catch (error) {
    console.error('Could not read back the saved passages:', error);
    return false;
  }
};
