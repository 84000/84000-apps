/**
 * The publish pipeline, as a resumable phase machine.
 *
 *   validate  run the SQL rule set; a hard fail ends the job having written nothing
 *   snapshot  one transaction in Postgres copies draft -> version-scoped published_* rows
 *   artifact  serialize those frozen rows to Storage, chunk by chunk
 *   index     write passages/index.json and glossary/index.json
 *   manifest  write manifest.json, record its hash on work_versions
 *   flip      update works.published_version_uuid, retire the previous version's rows
 *
 * Each phase lives in its own module and is uniform — takes a PhaseContext, returns the
 * job as it now stands — so this file only has to know the order, not the details.
 *
 * The pointer flip is the ONLY commit point. Everything before it is invisible to readers:
 * version-scoped keys mean the new version's rows sit alongside whatever is currently
 * serving, so a publish abandoned at any earlier phase leaves the previous version live and
 * is cleaned up by deleting its work_versions row.
 *
 * Ticks are bounded by a time budget rather than a row count. The median work (~510 rows)
 * completes every phase in the first tick, so a caller can await it; the handful of large
 * works checkpoint and continue on a later tick.
 */

export type { PhaseContext, PhaseRunner } from './context';
export { DEFAULT_TICK_BUDGET_MS, tickJob } from './tick';
export { startPublish, type StartPublishResult } from './start';
