/**
 * Quota pressure.
 *
 * Two questions, and only the second one really matters:
 *
 * 1. What happens when the origin approaches its quota — a clean error, or
 *    something worse?
 * 2. Does the journal survive? The cache is disposable by design and may be
 *    evicted freely, but unsynced edits are not, and the invariant from the
 *    project design is that they are never evictable.
 *
 * The cache table is filled deliberately, since that is the store that grows
 * without bound in production (works auto-cache on visit).
 */

import { makeCacheBody, makeRandom } from './fixtures';
import type { StorageApi } from '../types';

/** Result of pushing the origin toward its quota. */
export type QuotaResult = {
  persisted: boolean;
  quotaBytes: number;
  usageBeforeBytes: number;
  usagePeakBytes: number;
  usageAfterBytes: number;
  /** Cache entries written before the first failure. */
  entriesWritten: number;
  /** The error that stopped the fill, if any. */
  stoppedBy: string | null;
  /** Journal entries before and after, to prove edits were not evicted. */
  journalBefore: number;
  journalAfter: number;
  /** Whether every journal entry still verifies after the pressure test. */
  journalIntact: boolean;
  notes: string[];
};

/**
 * Fill the cache toward the origin quota, then check what survived.
 *
 * `targetFraction` caps how much of the quota to consume. Filling to a true
 * hard failure can wedge the whole origin in some engines, which destroys the
 * ability to observe the outcome — so the default stops short and relies on the
 * write error, not exhaustion, as the signal.
 */
export const runQuotaPressure = async (
  api: StorageApi,
  {
    targetFraction = 0.6,
    chunkBytes = 4 * 1024 * 1024,
    maxEntries = 4000,
    maxBytes = 512 * 1024 * 1024,
    onProgress,
  }: {
    targetFraction?: number;
    chunkBytes?: number;
    maxEntries?: number;
    /**
     * Absolute ceiling on bytes written, regardless of `targetFraction`.
     *
     * A desktop origin quota is a fraction of free disk, so "60% of quota" can
     * be tens of gigabytes. Reaching a real quota limit needs the quota lowered
     * from outside (Chromium: `Storage.overrideQuotaForOrigin` over CDP), not a
     * bigger fill. This cap keeps an un-overridden run from filling the disk.
     */
    maxBytes?: number;
    onProgress?: (written: number, usage: number) => void;
  } = {},
): Promise<QuotaResult> => {
  const random = makeRandom(99);
  const before = await api.quota();
  const journalBefore = await api.journalCount();

  const budget = Math.min(before.quota * targetFraction, maxBytes);
  const body = makeCacheBody(random, chunkBytes);

  let entriesWritten = 0;
  let stoppedBy: string | null = null;
  let usagePeak = before.usage;

  for (let i = 0; i < maxEntries; i++) {
    try {
      await api.putCache({
        key: `harness-fill-${i}`,
        body,
        expiresAt: Date.now() + 60_000,
      });
      entriesWritten++;
    } catch (error) {
      stoppedBy = error instanceof Error ? error.message : String(error);
      break;
    }

    // Checking usage is not free, so sample rather than poll every write.
    if (i % 10 === 0) {
      const current = await api.quota();
      usagePeak = Math.max(usagePeak, current.usage);
      onProgress?.(entriesWritten, current.usage);
      if (current.usage >= budget) {
        stoppedBy = `reached ${Math.round(targetFraction * 100)}% of quota`;
        break;
      }
    }
  }

  const after = await api.quota();
  const journalAfter = await api.journalCount();
  const integrity = await api.integrityCheck();

  const notes: string[] = [];
  if (!before.persisted) {
    notes.push(
      'Origin is NOT persisted — the browser may evict this database under ' +
        'pressure regardless of what this test observed.',
    );
  }
  if (journalAfter < journalBefore) {
    notes.push(
      `JOURNAL LOST ENTRIES under quota pressure: ${journalBefore} → ${journalAfter}.`,
    );
  }
  if (!integrity.databaseOk) {
    notes.push(
      `Integrity check failed after pressure: ${integrity.databaseErrors.join('; ')}`,
    );
  }
  if (stoppedBy === null) {
    notes.push(
      `Wrote the full ${maxEntries}-entry budget without hitting a limit; ` +
        'quota was never actually reached.',
    );
  }
  if (
    budget >= after.quota * targetFraction &&
    after.quota * targetFraction > maxBytes
  ) {
    notes.push(
      `Fill was capped at ${maxBytes} bytes, below ${Math.round(targetFraction * 100)}% ` +
        `of the ${after.quota}-byte quota. Eviction behaviour under real quota ` +
        'exhaustion was NOT exercised — lower the quota externally to test it.',
    );
  }

  return {
    persisted: after.persisted,
    quotaBytes: after.quota,
    usageBeforeBytes: before.usage,
    usagePeakBytes: Math.max(usagePeak, after.usage),
    usageAfterBytes: after.usage,
    entriesWritten,
    stoppedBy,
    journalBefore,
    journalAfter,
    journalIntact:
      journalAfter >= journalBefore && integrity.corruptJournalIds.length === 0,
    notes,
  };
};

/** Remove the fill entries written by `runQuotaPressure`. */
export const clearQuotaFill = async (api: StorageApi): Promise<number> =>
  api.evictExpiredCache(Date.now() + 10 * 60_000);
