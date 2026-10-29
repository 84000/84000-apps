import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import { loadStaticPassages } from '../stack/static-passage-html';

/** How long requests gather before one read serves them all. */
const BATCH_MS = 30;

type Load = (uuids: string[]) => Promise<Map<string, string>>;

/** Reads passage HTML for one work, batching the requests made together. */
export interface StaticPassageBatcher {
  /** The passage's static HTML, or null when it cannot be read. */
  get: (uuid: string) => Promise<string | null>;
}

/**
 * Collects the passages asked for within a short window and reads them in one
 * call. Nothing is cached past that call, so each read reflects saved edits.
 */
export const createStaticPassageBatcher = ({
  workUuid,
  load,
}: {
  workUuid: string;
  load?: Load;
}): StaticPassageBatcher => {
  const read: Load =
    load ??
    ((uuids) =>
      loadStaticPassages({ client: createGraphQLClient(), workUuid, uuids }));
  let pending = new Map<string, ((html: string | null) => void)[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    timer = undefined;
    const batch = pending;
    pending = new Map();
    let found: Map<string, string>;
    try {
      found = await read([...batch.keys()]);
    } catch (error) {
      console.error('Failed to load passages', error);
      found = new Map();
    }
    batch.forEach((resolvers, uuid) =>
      resolvers.forEach((resolve) => resolve(found.get(uuid) ?? null)),
    );
  };

  return {
    get: (uuid) =>
      new Promise<string | null>((resolve) => {
        pending.set(uuid, [...(pending.get(uuid) ?? []), resolve]);
        timer ??= setTimeout(() => void flush(), BATCH_MS);
      }),
  };
};
