/**
 * Corruption injection.
 *
 * The requirement is that damage is *detected*, not that it is survived. A
 * storage layer that returns plausible garbage from a damaged page is worse
 * than one that refuses to open, because the garbage gets synced to the server
 * and overwrites good data.
 *
 * Two independent injection points, because they exercise different defences:
 *
 * - Flipping bytes in the database file exercises SQLite's own page integrity
 *   (`PRAGMA integrity_check`).
 * - Flipping bytes inside a journal payload leaves the database structurally
 *   valid and exercises the per-entry checksum. This is the case SQLite alone
 *   cannot catch, and the reason the journal carries its own checksums.
 */

import { crc32 } from '../checksum';
import { VFS_DIRECTORY } from '../schema';
import type { DebugApi, StorageApi } from '../types';

/** Outcome of one injection. */
export type CorruptionResult = {
  target: 'database-file' | 'journal-payload';
  /**
   * Whether damage was actually inflicted.
   *
   * Tracked separately because an injector that fails to find its target has
   * tested nothing. Without this, a broken injector looks indistinguishable
   * from a clean pass — the harness would be reporting a result it never
   * measured.
   */
  injected: boolean;
  /** Bytes actually modified. */
  bytesFlipped: number;
  /** Whether the damage was reported on the next check. */
  detected: boolean;
  /** Whether any corrupt data was returned to a caller as if it were valid. */
  silentlyServed: boolean;
  details: string;
};

/** A scenario only passes if damage was inflicted, caught, and not served. */
export const corruptionPassed = (result: CorruptionResult): boolean =>
  result.injected && result.detected && !result.silentlyServed;

/**
 * Flip bytes directly in the SAH pool's OPFS files.
 *
 * The pool keeps its files in an `.opaque` subdirectory of the VFS directory,
 * each a fixed-size OPFS file with a metadata header holding the name mapping.
 * Every slot is the same size except the one holding real data, so the largest
 * file is the database.
 *
 * The database must be closed first: the pool holds exclusive sync access
 * handles, and OPFS will not grant a second writable handle while it does.
 */
export const corruptDatabaseFile = async (
  /**
   * Size of the live database, from `databaseSize()`.
   *
   * Required, because a pool file is a fixed-size slot and the database only
   * occupies a prefix of it. Choosing an offset as a fraction of the *file*
   * lands in unused slack, leaves the database untouched, and produces a
   * "corruption not detected" result that says nothing about the engine.
   */
  databaseBytes: number,
  /**
   * How many separate places to damage.
   *
   * One flip is not a reliable test. A database that has grown and shrunk
   * carries free pages, and `integrity_check` does not validate the contents of
   * unallocated pages — correctly, since nothing reads them. A single flip that
   * lands on a free page is reported as clean, which looks like a detection
   * failure but is not one. Spreading the damage makes hitting live pages
   * near-certain, so a clean result actually means something.
   */
  sites = 12,
  byteCount = 64,
): Promise<{
  bytesFlipped: number;
  fileName: string;
  fileSize: number;
  offsets: number[];
}> => {
  const root = await navigator.storage.getDirectory();
  const vfsDir = await root.getDirectoryHandle(VFS_DIRECTORY);
  const dir = await vfsDir.getDirectoryHandle('.opaque');

  let largest: {
    handle: FileSystemFileHandle;
    size: number;
    name: string;
  } | null = null;

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file') continue;
    const file = await (handle as FileSystemFileHandle).getFile();
    if (!largest || file.size > largest.size) {
      largest = {
        handle: handle as FileSystemFileHandle,
        size: file.size,
        name,
      };
    }
  }

  if (!largest) throw new Error('lib-persistence: no SAH pool files found');
  if (largest.size <= 4096) {
    throw new Error(
      `lib-persistence: largest SAH pool file is only ${largest.size} bytes; ` +
        'the database appears empty, so there is nothing to corrupt',
    );
  }

  const file = await largest.handle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());

  // The pool reserves a header for its name mapping; the database begins after
  // it. Aim inside the live database, not the slot's unused tail.
  const HEADER_BYTES = 4096;
  const liveEnd = Math.min(bytes.length, HEADER_BYTES + databaseBytes);
  const liveBytes = liveEnd - HEADER_BYTES;

  if (liveBytes <= byteCount) {
    throw new Error(
      `lib-persistence: only ${liveBytes} live database bytes available; ` +
        'seed more data before injecting corruption',
    );
  }

  const offsets: number[] = [];
  let bytesFlipped = 0;

  // Spread the sites evenly across the live range, skipping page 1 so the
  // database still opens. A file that cannot be opened at all is a different,
  // easier failure than one that opens and serves bad pages.
  const firstPageGuard = HEADER_BYTES + 4096;
  const span = Math.max(0, liveEnd - firstPageGuard);

  for (let site = 0; site < sites; site++) {
    const start = firstPageGuard + Math.floor((span * (site + 0.5)) / sites);
    const end = Math.min(liveEnd, start + byteCount);
    if (end <= start) continue;
    for (let i = start; i < end; i++) bytes[i] = bytes[i] ^ 0xff;
    offsets.push(start);
    bytesFlipped += end - start;
  }

  if (!bytesFlipped) throw new Error('lib-persistence: no bytes were flipped');

  const writable = await largest.handle.createWritable({
    keepExistingData: true,
  });
  await writable.write({ type: 'write', position: 0, data: bytes });
  await writable.close();

  return {
    bytesFlipped,
    fileName: largest.name,
    fileSize: bytes.length,
    offsets,
  };
};

/**
 * Corrupt a journal payload without touching its stored checksum.
 *
 * Done through SQL rather than at the byte level so the database stays
 * structurally perfect — isolating the per-entry checksum as the only thing
 * that can catch it.
 */
export const corruptJournalPayload = async (
  api: StorageApi & DebugApi,
): Promise<CorruptionResult> => {
  const before = await api.readJournal(1);
  if (!before.entries.length) {
    return {
      target: 'journal-payload',
      injected: false,
      bytesFlipped: 0,
      detected: false,
      silentlyServed: false,
      details: 'no journal entries to corrupt; run a write load first',
    };
  }

  const victim = before.entries[0];
  const damaged = new Uint8Array(victim.update);
  damaged[Math.floor(damaged.length / 2)] ^= 0xff;

  await api.corruptJournalEntry(victim.id, damaged);

  const after = await api.readJournal();
  const detected = after.corruptIds.includes(victim.id);
  const silentlyServed = after.entries.some((entry) => entry.id === victim.id);

  return {
    target: 'journal-payload',
    injected: true,
    bytesFlipped: 1,
    detected,
    silentlyServed,
    details: detected
      ? `entry ${victim.id} was withheld from replay (stored checksum ` +
        `${victim.checksum}, payload now ${crc32(damaged)})`
      : `entry ${victim.id} was NOT detected as corrupt`,
  };
};
