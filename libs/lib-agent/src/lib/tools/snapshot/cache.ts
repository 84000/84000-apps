import type { WorkSnapshotFiles } from './source';

/** Default memory budget: room for the largest work (about 210 MB loaded) and a few small ones. */
export const DEFAULT_SNAPSHOT_CACHE_BYTES = 384 * 1024 * 1024;

/** Approximate heap size of a loaded tree: strings are counted at two bytes a character. */
export const treeBytes = (files: WorkSnapshotFiles): number => {
  let chars = 0;
  for (const [path, content] of files) chars += path.length + content.length;
  return chars * 2;
};

/**
 * A process-wide, least-recently-used cache of loaded snapshot trees, bounded by
 * their approximate size in memory. Snapshots are immutable, so entries never go
 * stale; they are only evicted.
 */
export interface WorkSnapshotCache {
  /** The cached files for this snapshot id, marking them recently used. */
  get(snapshotId: string): WorkSnapshotFiles | undefined;
  /**
   * The files for this snapshot id, loading them once however many callers ask
   * at the same time. A tree larger than the whole budget is returned uncached.
   */
  load(
    snapshotId: string,
    loader: () => Promise<WorkSnapshotFiles>,
  ): Promise<WorkSnapshotFiles>;
  /** Total size of the cached trees, by `treeBytes`. */
  readonly bytes: number;
}

/** Create a cache holding at most `maxBytes` of loaded trees. */
export const createWorkSnapshotCache = ({
  maxBytes = DEFAULT_SNAPSHOT_CACHE_BYTES,
}: { maxBytes?: number } = {}): WorkSnapshotCache => {
  // A Map iterates in insertion order, so re-inserting on use keeps the least
  // recently used entry first.
  const entries = new Map<
    string,
    { files: WorkSnapshotFiles; bytes: number }
  >();
  const pending = new Map<string, Promise<WorkSnapshotFiles>>();
  let total = 0;

  const get = (snapshotId: string) => {
    const entry = entries.get(snapshotId);
    if (!entry) return undefined;
    entries.delete(snapshotId);
    entries.set(snapshotId, entry);
    return entry.files;
  };

  const put = (snapshotId: string, files: WorkSnapshotFiles) => {
    const bytes = treeBytes(files);
    if (bytes > maxBytes) return;
    for (const [id, entry] of entries) {
      if (total + bytes <= maxBytes) break;
      entries.delete(id);
      total -= entry.bytes;
    }
    entries.set(snapshotId, { files, bytes });
    total += bytes;
  };

  const load = (
    snapshotId: string,
    loader: () => Promise<WorkSnapshotFiles>,
  ) => {
    const cached = get(snapshotId);
    if (cached) return Promise.resolve(cached);
    const inFlight = pending.get(snapshotId);
    if (inFlight) return inFlight;
    const loading = loader()
      .then((files) => {
        put(snapshotId, files);
        return files;
      })
      .finally(() => pending.delete(snapshotId));
    pending.set(snapshotId, loading);
    return loading;
  };

  return {
    get,
    load,
    get bytes() {
      return total;
    },
  };
};
