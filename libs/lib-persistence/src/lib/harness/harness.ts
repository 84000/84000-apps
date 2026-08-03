/**
 * The torture harness: one object that runs every DEV-708 exit criterion.
 *
 * Exposed on `window.__storageHarness` so the same scenarios can be driven
 * three ways without reimplementation — by clicking buttons, by Playwright in
 * Chromium, and by hand in Firefox and Safari. That matters because
 * `playwright-webkit` is not Safari: its OPFS and SharedWorker implementations
 * differ from the shipping engine, so the browser most likely to fail is the
 * one automation cannot speak for. Every scenario therefore has to be runnable
 * by a human in a real browser.
 */

import { createStorageClient } from '../client/create-client';
import type { StorageClient } from '../client/storage-client';
import { clearLedger } from './ack-ledger';
import { runBenchmark, type BenchmarkResult } from './benchmark';
import {
  corruptDatabaseFile,
  corruptJournalPayload,
  type CorruptionResult,
} from './corruption';
import {
  startWriteLoad,
  verifyAfterKill,
  type KillVerdict,
  type WriteLoadState,
} from './durability';
import { startQueryLoad, type QueryLoadStats } from './migration';
import { clearQuotaFill, runQuotaPressure, type QuotaResult } from './quota';
import { runSearchScenario, type SearchReport } from './search';
import type {
  DebugApi,
  IntegrityReport,
  OpenReport,
  StorageApi,
} from '../types';

/** Everything the harness can report, for a single browser. */
export type HarnessReport = {
  userAgent: string;
  openReport: OpenReport | null;
  killVerdict: KillVerdict | null;
  queryLoad: QueryLoadStats | null;
  quota: QuotaResult | null;
  corruption: CorruptionResult[];
  benchmark: BenchmarkResult | null;
  search: SearchReport | null;
};

/**
 * Harness bound to one tab's storage client.
 *
 * Construct via `installHarness`, which also publishes it on `window`.
 */
export class StorageHarness {
  #client: StorageClient;
  #writeLoad: { state: WriteLoadState; stop: () => void } | null = null;
  #queryLoad: { stats: QueryLoadStats; stop: () => Promise<void> } | null =
    null;

  readonly report: HarnessReport = {
    userAgent:
      typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    openReport: null,
    killVerdict: null,
    queryLoad: null,
    quota: null,
    corruption: [],
    benchmark: null,
    search: null,
  };

  constructor(client: StorageClient) {
    this.#client = client;
    this.report.openReport = client.status.openReport;
  }

  get api(): StorageApi {
    return this.#client.api;
  }

  get debug(): DebugApi {
    return this.#client.debug;
  }

  get status() {
    return this.#client.status;
  }

  subscribe(listener: () => void): () => void {
    return this.#client.subscribe(listener);
  }

  // --- Scenario 1: kill the active tab mid-write ---

  /**
   * Begin the sequential tagged write load.
   *
   * The driver kills the tab while this runs; nothing here stops on its own.
   */
  startWriteLoad(runId = Math.floor(Date.now() % 100000)): WriteLoadState {
    this.#writeLoad?.stop();
    this.#writeLoad = startWriteLoad(this.#client.api, runId);
    return this.#writeLoad.state;
  }

  stopWriteLoad(): WriteLoadState | null {
    this.#writeLoad?.stop();
    return this.#writeLoad?.state ?? null;
  }

  get writeLoad(): WriteLoadState | null {
    return this.#writeLoad?.state ?? null;
  }

  /** Run after reloading a killed tab. */
  async verifyAfterKill(): Promise<KillVerdict> {
    const verdict = await verifyAfterKill(this.#client.api);
    this.report.killVerdict = verdict;
    return verdict;
  }

  // --- Scenario 2: ownership migration under load ---

  startQueryLoad(): QueryLoadStats {
    this.#queryLoad = startQueryLoad(this.#client.api);
    return this.#queryLoad.stats;
  }

  async stopQueryLoad(): Promise<QueryLoadStats | null> {
    await this.#queryLoad?.stop();
    this.report.queryLoad = this.#queryLoad?.stats ?? null;
    return this.report.queryLoad;
  }

  get queryLoad(): QueryLoadStats | null {
    return this.#queryLoad?.stats ?? null;
  }

  // --- Scenario 3: quota pressure ---

  async runQuotaPressure(targetFraction?: number): Promise<QuotaResult> {
    const result = await runQuotaPressure(this.#client.api, { targetFraction });
    this.report.quota = result;
    return result;
  }

  async clearQuotaFill(): Promise<number> {
    return clearQuotaFill(this.#client.api);
  }

  // --- Scenario 4: corruption injection ---

  /** Corrupt a journal payload; the database stays structurally valid. */
  async injectJournalCorruption(): Promise<CorruptionResult> {
    const result = await corruptJournalPayload({
      ...this.#client.api,
      ...this.#client.debug,
    } as StorageApi & DebugApi);
    this.report.corruption.push(result);
    return result;
  }

  /**
   * Flip bytes in the database file itself and re-open.
   *
   * Requires pausing the VFS so OPFS will hand out a writable handle, then
   * un-pausing to see what SQLite makes of the damage.
   */
  async injectDatabaseCorruption(): Promise<CorruptionResult> {
    // Read the live size before closing: the pool slot is fixed-size, so this
    // is the only way to know which bytes are actually database.
    const databaseBytes = await this.#client.api.databaseSize();
    await this.#client.debug.pauseVfs();

    let flipped: {
      bytesFlipped: number;
      fileName: string;
      fileSize: number;
      offsets: number[];
    } | null = null;
    let injectionError: string | null = null;
    let integrity: IntegrityReport;

    try {
      flipped = await corruptDatabaseFile(databaseBytes);
    } catch (error) {
      // The injector failing is not a result about SQLite. Record it as such
      // rather than letting a broken injector read as a clean pass.
      injectionError = error instanceof Error ? error.message : String(error);
    } finally {
      integrity = await this.#client.debug.unpauseVfs();
    }

    const result: CorruptionResult = injectionError
      ? {
          target: 'database-file',
          injected: false,
          bytesFlipped: 0,
          detected: false,
          silentlyServed: false,
          details: `INJECTION FAILED, nothing was tested: ${injectionError}`,
        }
      : {
          target: 'database-file',
          injected: true,
          bytesFlipped: flipped?.bytesFlipped ?? 0,
          detected: !integrity.databaseOk,
          // If SQLite reports the database as healthy after we scrambled its
          // pages, it is serving whatever those pages now contain.
          silentlyServed: integrity.databaseOk,
          details: integrity.databaseOk
            ? `NOT DETECTED: ${flipped?.bytesFlipped} bytes flipped across ` +
              `${flipped?.offsets.length} sites in ${flipped?.fileName} (slot ` +
              `${flipped?.fileSize} bytes, live database ${databaseBytes} bytes) ` +
              'and integrity_check still reports ok'
            : `detected on re-open: ${integrity.databaseErrors.slice(0, 3).join('; ')}`,
        };

    this.report.corruption.push(result);
    return result;
  }

  // --- Scenario 6: offline reader search ---

  async runSearch(passages?: number): Promise<SearchReport> {
    const result = await runSearchScenario(this.#client.api, passages);
    this.report.search = result;
    return result;
  }

  // --- Scenario 5: measurements ---

  async runBenchmark(passageCount?: number): Promise<BenchmarkResult> {
    const result = await runBenchmark(this.#client.api, {
      passageCount,
      coldOpenMs: this.#client.status.openReport?.coldOpenMs ?? null,
    });
    this.report.benchmark = result;
    return result;
  }

  // --- Housekeeping ---

  async integrityCheck(): Promise<IntegrityReport> {
    return this.#client.api.integrityCheck();
  }

  /** Clear all stores and the ack ledger, for a clean run. */
  async reset(): Promise<void> {
    this.#writeLoad?.stop();
    await this.#queryLoad?.stop();
    await this.#client.debug.wipe();
    clearLedger();
    this.report.killVerdict = null;
    this.report.queryLoad = null;
    this.report.quota = null;
    this.report.corruption = [];
    this.report.benchmark = null;
    this.report.search = null;
  }
}

declare global {
  interface Window {
    /** Present only on the spike harness route. */
    __storageHarness?: StorageHarness;
  }
}

/**
 * Create the storage client for this tab and publish a harness on `window`.
 *
 * Returns the harness so React can hold it; the global exists for Playwright
 * and for driving scenarios by hand from a devtools console in Firefox and
 * Safari.
 */
export const installHarness = async (): Promise<StorageHarness> => {
  const client = await createStorageClient();
  const harness = new StorageHarness(client);
  window.__storageHarness = harness;
  return harness;
};
