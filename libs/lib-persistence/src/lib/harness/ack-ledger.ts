/**
 * A record of which writes the storage layer told us had committed.
 *
 * The kill-mid-write test needs an oracle for "this edit was acknowledged".
 * `localStorage` is used because it is synchronous and written on a different
 * path from OPFS, so a crash cannot reorder one against the other.
 *
 * `localStorage` is itself not perfectly crash-durable, which sounds like it
 * undermines the oracle but does not: losing an ack record can only make the
 * ledger lag behind the journal, and a journal that is *ahead* of the ledger is
 * the benign direction. The failing direction — an ack recorded for an edit the
 * journal does not contain — is real, unambiguous data loss. The oracle can
 * therefore under-report but never raise a false alarm.
 */

const KEY = '84000-harness-acks';

type Ledger = { runId: number; highestAcked: number };

const read = (): Ledger | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Ledger) : null;
  } catch (error) {
    console.error('lib-persistence: ack ledger read failed', error);
    return null;
  }
};

/** Begin a new run, discarding any previous ledger. */
export const startRun = (runId: number): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ runId, highestAcked: 0 }));
  } catch (error) {
    console.error('lib-persistence: ack ledger start failed', error);
  }
};

/** Record that the write with this sequence number was acknowledged. */
export const recordAck = (runId: number, sequence: number): void => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ runId, highestAcked: sequence }),
    );
  } catch (error) {
    console.error('lib-persistence: ack ledger write failed', error);
  }
};

/** Read the ledger left behind by a previous (possibly killed) run. */
export const readLedger = (): Ledger | null => read();

/** Discard the ledger. */
export const clearLedger = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    console.error('lib-persistence: ack ledger clear failed', error);
  }
};
