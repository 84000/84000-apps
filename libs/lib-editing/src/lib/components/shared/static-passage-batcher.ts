import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import { loadStaticPassages } from '../stack/static-passage-html';

/** How long requests gather before one read serves them all. */
const BATCH_MS = 30;
/** Passages kept once read; the oldest are dropped past this. */
const MAX_CACHED = 500;

type Load = (uuids: string[]) => Promise<Map<string, string>>;

/** Reads passage HTML for one work, batching the requests made together. */
export interface StaticPassageBatcher {
  /**
   * The passage's static HTML, or null when it cannot be read. `version`
   * names the content the caller expects: a different one reads it again.
   */
  get: (uuid: string, version?: string) => Promise<string | null>;
}

/**
 * Collects the passages asked for within a short window and reads them in one
 * call, caching each by uuid and version.
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
  const cache = new Map<string, Promise<string | null>>();
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
    get: (uuid, version = '') => {
      const key = `${uuid}\u0000${version}`;
      const cached = cache.get(key);
      if (cached) return cached;

      const promise = new Promise<string | null>((resolve) => {
        pending.set(uuid, [...(pending.get(uuid) ?? []), resolve]);
        timer ??= setTimeout(() => void flush(), BATCH_MS);
      });
      cache.set(key, promise);
      if (cache.size > MAX_CACHED) {
        cache.delete(cache.keys().next().value as string);
      }
      // A failed read is not kept, so the passage is tried again next time.
      void promise.then((html) => {
        if (html === null) cache.delete(key);
      });
      return promise;
    },
  };
};
