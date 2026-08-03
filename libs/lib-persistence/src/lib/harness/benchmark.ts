/**
 * Throughput and load-cost measurements.
 *
 * The comparison against IndexedDB is the one that decides the fallback: if
 * IndexedDB is competitive for our access patterns, the two-engine fallback
 * costs less than it looks, and the case for a single SQLite engine rests
 * entirely on atomic multi-store commits rather than on speed.
 *
 * Access patterns measured are the ones the editor actually performs, not
 * generic microbenchmarks:
 *
 * - Bulk load of a work's passage docs (what happens on first visit).
 * - Windowed reads of ~40 passages (what the virtualized editor does on scroll).
 * - Single-entry journal appends (what happens on every edit while offline).
 */

import {
  makeJournalUpdate,
  makePassageDoc,
  makePassageUuids,
  makeRandom,
} from './fixtures';
import { IdbBaseline } from './idb-baseline';
import { COORDINATOR_URL, SQLITE_MODULE_URL } from '../schema';
import type { StorageApi } from '../types';

const WORK_UUID = 'harness-bench';

/** One measurement. */
export type Measurement = {
  label: string;
  operations: number;
  totalMs: number;
  /** Operations per second. */
  opsPerSecond: number;
  /** Mean milliseconds per operation. */
  meanMs: number;
  bytes: number;
};

/** SQLite against IndexedDB across the editor's access patterns. */
export type BenchmarkResult = {
  sqlite: Measurement[];
  indexedDb: Measurement[];
  coldOpenMs: number | null;
  idbOpenMs: number;
  /** Bytes transferred for the SQLite WASM binary and worker bundles. */
  bundleBytes: BundleCost;
  notes: string[];
};

const measure = (
  label: string,
  operations: number,
  bytes: number,
  totalMs: number,
): Measurement => ({
  label,
  operations,
  totalMs,
  opsPerSecond: operations / (totalMs / 1000),
  meanMs: totalMs / operations,
  bytes,
});

/** Cost of the WASM payload, read from Resource Timing. */
export type BundleCost = {
  entries: { name: string; transferBytes: number; decodedBytes: number }[];
  totalTransferBytes: number;
  totalDecodedBytes: number;
  note: string;
};

/**
 * Measure what the storage stack costs to load.
 *
 * The WASM binary and the SQLite glue are fetched *by the worker*, so they never
 * appear in the page's Resource Timing buffer — reading it from here returns an
 * empty list and looks like zero cost. They are fetched explicitly instead.
 *
 * That they load off the page's critical path is the substantive point: the
 * storage stack does not block first paint, it blocks first *query*.
 */
export const measureBundleCost = async (): Promise<BundleCost> => {
  const assets = [
    SQLITE_MODULE_URL,
    '/sqlite-wasm/sqlite3.wasm',
    COORDINATOR_URL,
  ];

  const entries = await Promise.all(
    assets.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        const buffer = await response.arrayBuffer();
        const encoded = response.headers.get('content-length');
        return {
          name: url.split('/').slice(-1)[0],
          transferBytes: encoded ? Number(encoded) : buffer.byteLength,
          decodedBytes: buffer.byteLength,
        };
      } catch {
        return { name: url, transferBytes: 0, decodedBytes: 0 };
      }
    }),
  );

  return {
    entries,
    totalTransferBytes: entries.reduce((sum, e) => sum + e.transferBytes, 0),
    totalDecodedBytes: entries.reduce((sum, e) => sum + e.decodedBytes, 0),
    note:
      'Fetched by the worker, not the page, so this is off the critical path ' +
      'for first paint. transferBytes reflects Content-Length, which in dev is ' +
      'uncompressed; production serves these gzipped.',
  };
};

/**
 * Run the benchmark suite.
 *
 * `passageCount` should exceed the largest real work (854 passages locally) to
 * say anything about the "thousands of pages" case the project targets.
 */
export const runBenchmark = async (
  api: StorageApi,
  {
    passageCount = 2000,
    windowSize = 40,
    journalWrites = 200,
    coldOpenMs = null,
  }: {
    passageCount?: number;
    windowSize?: number;
    journalWrites?: number;
    coldOpenMs?: number | null;
  } = {},
): Promise<BenchmarkResult> => {
  const random = makeRandom(1234);
  const uuids = makePassageUuids(passageCount, WORK_UUID);
  const docs = uuids.map(() => makePassageDoc(random));
  const totalBytes = docs.reduce((sum, doc) => sum + doc.length, 0);

  const sqlite: Measurement[] = [];
  const indexedDb: Measurement[] = [];
  const notes: string[] = [];

  // --- SQLite ---

  const records = uuids.map((uuid, i) => ({
    uuid,
    workUuid: WORK_UUID,
    doc: docs[i],
    version: 1,
  }));

  let started = performance.now();
  await api.putPassageDocs(records);
  sqlite.push(
    measure(
      `bulk write ${passageCount} docs (1 txn)`,
      passageCount,
      totalBytes,
      performance.now() - started,
    ),
  );

  // The same load done one statement at a time, which is what a naive
  // implementation would do. The gap between the two is the cost of fsyncing
  // per row under synchronous=FULL, and it is the single biggest performance
  // decision in this design.
  started = performance.now();
  const unbatchedCount = Math.min(200, passageCount);
  for (let i = 0; i < unbatchedCount; i++) {
    await api.putPassageDoc(records[i]);
  }
  sqlite.push(
    measure(
      `write ${unbatchedCount} docs (1 txn each)`,
      unbatchedCount,
      records.slice(0, unbatchedCount).reduce((s, r) => s + r.doc.length, 0),
      performance.now() - started,
    ),
  );

  const windowStart = Math.floor(passageCount / 2);
  started = performance.now();
  let windowBytes = 0;
  for (let i = windowStart; i < windowStart + windowSize; i++) {
    const record = await api.getPassageDoc(uuids[i]);
    windowBytes += record?.doc.length ?? 0;
  }
  sqlite.push(
    measure(
      `windowed read of ${windowSize} passages`,
      windowSize,
      windowBytes,
      performance.now() - started,
    ),
  );

  const journalUpdates = Array.from({ length: journalWrites }, () =>
    makeJournalUpdate(random),
  );
  const journalBytes = journalUpdates.reduce((sum, u) => sum + u.length, 0);

  started = performance.now();
  for (const update of journalUpdates) {
    await api.appendJournal({
      passageUuid: uuids[0],
      workUuid: WORK_UUID,
      update,
    });
  }
  sqlite.push(
    measure(
      `${journalWrites} single journal appends (synchronous=FULL)`,
      journalWrites,
      journalBytes,
      performance.now() - started,
    ),
  );

  // --- IndexedDB baseline ---

  const baseline = new IdbBaseline();
  const idbOpenMs = await baseline.open();
  await baseline.clear();

  started = performance.now();
  await baseline.putPassageDocs(
    records.map((r) => ({ uuid: r.uuid, doc: r.doc })),
  );
  indexedDb.push(
    measure(
      `bulk write ${passageCount} docs (1 txn)`,
      passageCount,
      totalBytes,
      performance.now() - started,
    ),
  );

  started = performance.now();
  for (let i = 0; i < unbatchedCount; i++) {
    await baseline.putPassageDoc(uuids[i], docs[i]);
  }
  indexedDb.push(
    measure(
      `write ${unbatchedCount} docs (1 txn each)`,
      unbatchedCount,
      records.slice(0, unbatchedCount).reduce((s, r) => s + r.doc.length, 0),
      performance.now() - started,
    ),
  );

  started = performance.now();
  windowBytes = 0;
  for (let i = windowStart; i < windowStart + windowSize; i++) {
    const doc = await baseline.getPassageDoc(uuids[i]);
    windowBytes += doc?.length ?? 0;
  }
  indexedDb.push(
    measure(
      `windowed read of ${windowSize} passages`,
      windowSize,
      windowBytes,
      performance.now() - started,
    ),
  );

  started = performance.now();
  for (const update of journalUpdates) {
    await baseline.appendJournal(update);
  }
  indexedDb.push(
    measure(
      `${journalWrites} single journal appends (one txn each)`,
      journalWrites,
      journalBytes,
      performance.now() - started,
    ),
  );

  await baseline.clear();
  baseline.close();

  notes.push(
    'SQLite runs in a worker; the IndexedDB baseline runs on the main thread, ' +
      'so its figures exclude the postMessage round trip that the SQLite ' +
      'numbers include. The comparison is therefore conservative toward IndexedDB.',
  );

  return {
    sqlite,
    indexedDb,
    coldOpenMs,
    idbOpenMs,
    bundleBytes: await measureBundleCost(),
    notes,
  };
};
