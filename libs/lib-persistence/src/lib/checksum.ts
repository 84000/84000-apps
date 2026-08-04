/**
 * Checksums for journal payloads.
 *
 * The journal is the only copy of unsynced offline work, so every entry stores
 * a checksum over its payload. SQLite's own page checksums are not enough: they
 * detect a damaged page, not a payload that was written correctly into a page
 * that later got rewritten with stale or partial bytes. A per-entry checksum
 * lets a reader reject exactly the bad entries instead of trusting the table.
 *
 * CRC-32 is used rather than a cryptographic hash because this guards against
 * accidental corruption, not tampering, and it must stay cheap enough to run on
 * every keystroke-sized update.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Compute the CRC-32 of a byte array.
 *
 * Returned as a signed 32-bit integer so it round-trips through SQLite's
 * INTEGER column without precision surprises.
 */
export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) | 0;
};

/** Verify a payload against a previously stored checksum. */
export const verifyChecksum = (bytes: Uint8Array, expected: number): boolean =>
  crc32(bytes) === expected;
