/**
 * Synthetic workloads shaped like real 84000 data.
 *
 * Sizes come from the local development database (854-passage work, the
 * largest available): mean passage content 273 bytes, p50 213, p95 755, max
 * 1847, with a mean of 5.7 annotations per passage at ~64 bytes each. A passage
 * doc blob is modelled as content plus annotations plus Yjs framing overhead.
 *
 * Two deliberate simplifications, because they change what the numbers mean:
 *
 * 1. Blobs are synthetic bytes, not real encoded Yjs documents. This spike
 *    measures the storage engine, and DEV-707 covers the Yjs layer. Real Yjs
 *    docs accumulate history between compactions, so a production doc will be
 *    *larger* than modelled here — the throughput figures are therefore an
 *    optimistic bound, not a worst case.
 * 2. The largest local work is 854 passages, but the project targets works of
 *    "thousands of pages". Work sizes here scale well past what local data
 *    contains, so the numbers extrapolate rather than replay.
 */

/** Measured characteristics of a passage in the local database. */
export const PASSAGE_PROFILE = {
  meanContentBytes: 273,
  p95ContentBytes: 755,
  maxContentBytes: 1847,
  meanAnnotations: 5.7,
  meanAnnotationBytes: 64,
  /** Yjs encodes structure alongside content; a rough per-doc constant. */
  framingBytes: 96,
} as const;

/**
 * Deterministic pseudo-random source.
 *
 * Seeded so a run is reproducible: comparing SQLite against IndexedDB is only
 * meaningful if both see byte-identical payloads.
 */
export const makeRandom = (seed: number): (() => number) => {
  let state = seed >>> 0 || 1;
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0xffffffff) / 0xffffffff;
  };
};

/** Typical encoded size of one passage doc, in bytes. */
export const passageDocBytes = (random: () => number): number => {
  // Content length is strongly right-skewed; approximate with a clamped
  // exponential around the measured mean.
  const skewed = -Math.log(1 - random()) * PASSAGE_PROFILE.meanContentBytes;
  const content = Math.min(skewed, PASSAGE_PROFILE.maxContentBytes);
  const annotations =
    PASSAGE_PROFILE.meanAnnotations * PASSAGE_PROFILE.meanAnnotationBytes;
  return Math.round(content + annotations + PASSAGE_PROFILE.framingBytes);
};

/** Fill a buffer with cheap, non-compressible-ish bytes. */
const fill = (bytes: Uint8Array, random: () => number): Uint8Array => {
  for (let i = 0; i < bytes.length; i++) bytes[i] = (random() * 256) | 0;
  return bytes;
};

/** A synthetic passage document blob. */
export const makePassageDoc = (random: () => number): Uint8Array =>
  fill(new Uint8Array(passageDocBytes(random)), random);

/**
 * A synthetic journal payload.
 *
 * Journal entries are single edits, far smaller than a whole doc — roughly a
 * keystroke-to-sentence worth of Yjs update.
 */
export const makeJournalUpdate = (
  random: () => number,
  bytes = 48 + Math.round(random() * 200),
): Uint8Array => fill(new Uint8Array(bytes), random);

/**
 * Encode a run id and sequence number into the head of a journal payload.
 *
 * The kill-mid-write test needs to know, after a crash, exactly which writes
 * are present. Tagging the payload itself means the check does not depend on
 * rowids surviving, and it is covered by the entry's checksum like any other
 * byte.
 */
export const tagJournalUpdate = (
  update: Uint8Array,
  runId: number,
  sequence: number,
): Uint8Array => {
  const tagged = new Uint8Array(update.length + 8);
  const view = new DataView(tagged.buffer);
  view.setUint32(0, runId, true);
  view.setUint32(4, sequence, true);
  tagged.set(update, 8);
  return tagged;
};

/** Read back the tag written by `tagJournalUpdate`. */
export const readJournalTag = (
  update: Uint8Array,
): { runId: number; sequence: number } | null => {
  if (update.length < 8) return null;
  const view = new DataView(
    update.buffer,
    update.byteOffset,
    update.byteLength,
  );
  return { runId: view.getUint32(0, true), sequence: view.getUint32(4, true) };
};

/** A synthetic cache body, sized like a cached API response. */
export const makeCacheBody = (
  random: () => number,
  bytes = 32 * 1024,
): Uint8Array => fill(new Uint8Array(bytes), random);

/** Generate a work's worth of passage uuids. */
export const makePassageUuids = (count: number, workUuid: string): string[] =>
  Array.from({ length: count }, (_, index) => `${workUuid}-p${index}`);
