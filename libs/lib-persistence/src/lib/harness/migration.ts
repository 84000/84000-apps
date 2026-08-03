/**
 * Ownership migration under load.
 *
 * The scenario: several tabs are open, one owns the database, and the owner is
 * killed while the others have queries in flight. The requirement is that the
 * surviving tabs keep working. A query that was in flight at the moment of the
 * kill may legitimately be slow — it has to wait for a new owner to win the
 * lock and open the database — but it must not fail, and it must not return a
 * wrong answer.
 *
 * Failures are counted separately from retries because they mean different
 * things: retries are the mechanism working, failures are the user seeing an
 * error.
 */

import { makePassageDoc, makeRandom } from './fixtures';
import type { StorageApi } from '../types';

const WORK_UUID = 'harness-migration';

/** Running tally of a query load. */
export type QueryLoadStats = {
  issued: number;
  succeeded: number;
  failed: number;
  /** Reads that returned something other than what was written. */
  wrongAnswers: number;
  /** Longest single call, which is where migration cost shows up. */
  maxLatencyMs: number;
  running: boolean;
  errors: string[];
};

/**
 * Continuously write a passage doc and read it back, verifying the round trip.
 *
 * Round-tripping rather than just reading means a torn handoff that served
 * stale or empty data would be caught, not just one that threw.
 */
export const startQueryLoad = (
  api: StorageApi,
  seed = 7,
): { stats: QueryLoadStats; stop: () => Promise<void> } => {
  const random = makeRandom(seed);
  const stats: QueryLoadStats = {
    issued: 0,
    succeeded: 0,
    failed: 0,
    wrongAnswers: 0,
    maxLatencyMs: 0,
    running: true,
    errors: [],
  };

  let finished: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });

  const loop = async () => {
    while (stats.running) {
      const index = stats.issued++;
      const uuid = `${WORK_UUID}-p${index % 32}`;
      const doc = makePassageDoc(random);
      const started = performance.now();

      try {
        await api.putPassageDoc({
          uuid,
          workUuid: WORK_UUID,
          doc,
          version: index,
        });
        const readBack = await api.getPassageDoc(uuid);

        const matches =
          readBack !== null &&
          readBack.version === index &&
          readBack.doc.length === doc.length;

        if (matches) stats.succeeded++;
        else stats.wrongAnswers++;
      } catch (error) {
        stats.failed++;
        const message = error instanceof Error ? error.message : String(error);
        if (stats.errors.length < 10) stats.errors.push(message);
      }

      stats.maxLatencyMs = Math.max(
        stats.maxLatencyMs,
        performance.now() - started,
      );
    }
    finished();
  };

  void loop();

  return {
    stats,
    stop: async () => {
      stats.running = false;
      await done;
    },
  };
};
