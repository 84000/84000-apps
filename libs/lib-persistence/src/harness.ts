/**
 * Torture-harness entry point for the DEV-708 spike.
 *
 * On a separate subpath from the main barrel so that nothing which imports
 * `@eightyfourthousand/lib-persistence` for storage drags in the destructive
 * scenarios or the IndexedDB baseline.
 */

export { installHarness, StorageHarness } from './lib/harness/harness';
export type { HarnessReport } from './lib/harness/harness';
export type { KillVerdict, WriteLoadState } from './lib/harness/durability';
export type { QueryLoadStats } from './lib/harness/migration';
export type { QuotaResult } from './lib/harness/quota';
export type { CorruptionResult } from './lib/harness/corruption';
export type { BenchmarkResult, Measurement } from './lib/harness/benchmark';
export { PASSAGE_PROFILE } from './lib/harness/fixtures';
