/**
 * What every publish phase receives.
 *
 * Phases are uniform on purpose: each takes this context, does its work, and returns the
 * job as it now stands. That lets the orchestrator dispatch through a lookup rather than a
 * switch that has to know which phase wants which arguments, and it keeps the phases
 * independently readable — nothing about the artifact phase is coupled to the flip.
 *
 * A phase is responsible for checkpointing its own progress before it returns. The
 * returned job must match what was persisted, since the orchestrator uses it to decide
 * whether to keep going.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type { PublishJob } from '../types';

export interface PhaseContext {
  client: DataClient;
  job: PublishJob;
  /** Injectable so tests can pin timestamps. */
  clock: () => Date;
  /** Injectable so tests can pin version uuids. */
  makeUuid: () => string;
  /** Version label supplied by the caller; otherwise patch-bumped from history. */
  explicitVersion?: string;
  publishedBy?: string | null;
  notes?: string | null;
  /** See PublishOptions.refreshGlossaryIndex. Defaults to true when undefined. */
  refreshGlossaryIndex?: boolean;
  /**
   * True once the tick has spent its time budget.
   *
   * Only the artifact phase consults this, because it is the only phase that loops over an
   * unbounded amount of work. It must still complete at least one unit before honouring it
   * — a phase that returns having done nothing livelocks the job.
   */
  outOfBudget: () => boolean;
}

export type PhaseRunner = (context: PhaseContext) => Promise<PublishJob>;
