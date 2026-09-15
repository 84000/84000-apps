import { Doc, applyUpdate, encodeStateAsUpdate, encodeStateVector } from 'yjs';

import { fromBase64 } from './encoding';
import type { PassageDocState } from './types';

export type CompactionResult = {
  passageUuid: string;
  seqThrough: number;
  rowsDeleted: number;
  docBytes: number;
};

/**
 * Fold a passage's log into a snapshot.
 *
 * The merge has to happen outside Postgres because it needs the Yjs
 * implementation, so this runs wherever a scheduled job runs — an edge function
 * in the spike. The commit is `compact_passage_doc`, which writes the snapshot
 * and deletes the rows it covers in one transaction.
 *
 * Why this is safe against a live session, which is one of the spike's exit
 * criteria:
 *
 * - `seqThrough` is the highest seq this function actually *read and merged*,
 *   never `max(seq)` sampled separately. A row that committed after the read
 *   keeps a seq above the watermark and survives the delete.
 * - Readers never resume from a seq. `get_passage_doc_state` hands back the
 *   snapshot and its uncovered rows in a single transaction, so a client cannot
 *   observe a snapshot whose successors have already been collected.
 * - A live editor is unaffected either way: its document already contains
 *   everything being compacted, and compaction adds no new updates for it to
 *   receive.
 */
export const compactPassageDoc = async (params: {
  passageUuid: string;
  workUuid: string;
  fetchState: (passageUuid: string) => Promise<PassageDocState>;
  commit: (input: {
    passageUuid: string;
    workUuid: string;
    doc: Uint8Array;
    stateVector: Uint8Array;
    seqThrough: number;
  }) => Promise<number>;
}): Promise<CompactionResult | null> => {
  const state = await params.fetchState(params.passageUuid);

  if (state.updates.length === 0) {
    return null;
  }

  const doc = new Doc();

  if (state.snapshot) {
    applyUpdate(doc, fromBase64(state.snapshot.doc));
  }

  let seqThrough = state.snapshot?.seqThrough ?? 0;
  for (const row of state.updates) {
    applyUpdate(doc, fromBase64(row.update));
    // Only rows that were merged raise the watermark. A null seq means the row
    // came from a direct client broadcast rather than the log and was never
    // stored, so it must not be treated as collected.
    if (row.seq !== null && row.seq > seqThrough) seqThrough = row.seq;
  }

  const encoded = encodeStateAsUpdate(doc);
  const stateVector = encodeStateVector(doc);

  const rowsDeleted = await params.commit({
    passageUuid: params.passageUuid,
    workUuid: params.workUuid,
    doc: encoded,
    stateVector,
    seqThrough,
  });

  doc.destroy();

  return {
    passageUuid: params.passageUuid,
    seqThrough,
    rowsDeleted,
    docBytes: encoded.byteLength,
  };
};
