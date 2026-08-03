/**
 * The kill-mid-write scenario: the exit criterion this whole spike exists for.
 *
 * Notion can treat its browser database as a disposable cache. We cannot: while
 * a translator is offline the journal is the only copy of their work. So the
 * property under test is not "the database usually survives" but "an edit the
 * storage layer acknowledged is still there after the tab is killed, or the
 * damage is detected loudly on the next open".
 *
 * The run is deliberately strictly sequential — each append is awaited before
 * the next is issued. That makes the expected post-crash state exactly
 * describable: a contiguous prefix `1..k` and nothing else. Any hole in the
 * middle is silent partial state, which is the failure mode we care about.
 */

import { recordAck, readLedger, startRun } from './ack-ledger';
import {
  makeJournalUpdate,
  makeRandom,
  readJournalTag,
  tagJournalUpdate,
} from './fixtures';
import type { StorageApi } from '../types';

const WORK_UUID = 'harness-work';

/** Live state of an in-progress write load. */
export type WriteLoadState = {
  runId: number;
  issued: number;
  acked: number;
  running: boolean;
};

/** Verdict after re-opening the database following a kill. */
export type KillVerdict = {
  runId: number;
  /** Highest sequence the storage layer acknowledged before the kill. */
  highestAcked: number;
  /** Highest sequence actually present in the journal. */
  highestPersisted: number;
  /** Sequences missing from within the persisted range. */
  holes: number[];
  /** Journal entries whose checksum did not verify. */
  corruptIds: number[];
  /** Entries present that belong to a different run. */
  strayEntries: number;
  /** True when acknowledged work survived and nothing was silently partial. */
  passed: boolean;
  notes: string[];
};

/**
 * Append tagged journal entries one at a time until stopped.
 *
 * Returns a handle rather than a promise: the caller (or an external driver
 * about to crash the tab) needs to observe progress while it runs.
 */
export const startWriteLoad = (
  api: StorageApi,
  runId: number,
  onProgress?: (state: WriteLoadState) => void,
): { state: WriteLoadState; stop: () => void } => {
  const random = makeRandom(runId);
  const state: WriteLoadState = { runId, issued: 0, acked: 0, running: true };

  startRun(runId);

  const loop = async () => {
    while (state.running) {
      const sequence = state.issued + 1;
      const update = tagJournalUpdate(
        makeJournalUpdate(random),
        runId,
        sequence,
      );
      state.issued = sequence;
      try {
        await api.appendJournal({
          passageUuid: `${WORK_UUID}-p${sequence % 64}`,
          workUuid: WORK_UUID,
          update,
        });
      } catch (error) {
        // A failed append is not a durability violation — it is the loud
        // failure we want. Stop so the sequence stays a clean prefix.
        console.error('lib-persistence: harness append failed', error);
        state.running = false;
        break;
      }
      // Ack only after the write resolved; ordering here is the whole oracle.
      state.acked = sequence;
      recordAck(runId, sequence);
      onProgress?.({ ...state });
    }
  };

  void loop();

  return {
    state,
    stop: () => {
      state.running = false;
    },
  };
};

/**
 * Inspect the journal after a kill and decide whether durability held.
 *
 * Call on a freshly opened database in a new page load.
 */
export const verifyAfterKill = async (
  api: StorageApi,
): Promise<KillVerdict> => {
  const ledger = readLedger();
  const runId = ledger?.runId ?? 0;
  const highestAcked = ledger?.highestAcked ?? 0;

  const { entries, corruptIds } = await api.readJournal();

  const sequences: number[] = [];
  let strayEntries = 0;

  for (const entry of entries) {
    const tag = readJournalTag(entry.update);
    if (!tag || tag.runId !== runId) {
      strayEntries++;
      continue;
    }
    sequences.push(tag.sequence);
  }

  sequences.sort((a, b) => a - b);
  const highestPersisted = sequences.length
    ? sequences[sequences.length - 1]
    : 0;

  const present = new Set(sequences);
  const holes: number[] = [];
  for (let seq = 1; seq <= highestPersisted; seq++) {
    if (!present.has(seq)) holes.push(seq);
  }

  const notes: string[] = [];
  let passed = true;

  if (highestPersisted < highestAcked) {
    passed = false;
    notes.push(
      `LOST ACKNOWLEDGED WORK: ${highestAcked - highestPersisted} acknowledged ` +
        `entries are absent (acked up to ${highestAcked}, journal holds ${highestPersisted}).`,
    );
  }

  if (holes.length) {
    passed = false;
    notes.push(
      `SILENT PARTIAL STATE: ${holes.length} gaps inside the persisted range ` +
        `(first missing sequence ${holes[0]}).`,
    );
  }

  if (corruptIds.length) {
    // Detected corruption is a pass for the "fails loudly" half of the
    // criterion — the entries were withheld rather than replayed — but it is
    // still worth surfacing prominently.
    notes.push(
      `${corruptIds.length} entries failed checksum and were withheld from ` +
        `replay rather than returned as valid.`,
    );
  }

  if (strayEntries) {
    notes.push(
      `${strayEntries} entries from an earlier run were still present.`,
    );
  }

  if (passed && notes.length === 0) {
    notes.push(
      `All ${highestAcked} acknowledged entries survived; journal holds a ` +
        `contiguous prefix through ${highestPersisted}.`,
    );
  }

  return {
    runId,
    highestAcked,
    highestPersisted,
    holes,
    corruptIds,
    strayEntries,
    passed,
    notes,
  };
};
