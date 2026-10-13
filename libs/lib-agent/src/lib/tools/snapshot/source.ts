/**
 * What the work snapshot tools need from their host: a way to ensure a work's
 * draft snapshot and a way to load its files. The host supplies both, so this
 * library never touches storage or credentials itself.
 */

/** One file in a snapshot's manifest. */
export interface WorkSnapshotFile {
  path: string;
  bytes: number;
  lines: number;
}

/** The parts of a snapshot manifest the tools read. Every field is optional. */
export interface WorkSnapshotManifest {
  tohs?: string[];
  title?: string | null;
  counts?: Record<string, number>;
  totals?: { files: number; bytes: number; lines: number };
  files?: WorkSnapshotFile[];
}

/** A signed, short-lived download for one archive. */
export interface WorkSnapshotDownload {
  url: string;
  expiresAt: string;
  filename: string;
}

/** A stored snapshot, with how it relates to the live draft. */
export interface ReadyWorkSnapshot {
  status: 'ready';
  /** Identifies one immutable archive. */
  snapshotId: string;
  workUuid: string;
  /** The archive's top-level directory. */
  root: string;
  generatedAt: string;
  /** Built from the current draft and not older than a day. */
  current: boolean;
  /** The draft was edited after this snapshot was built. */
  draftChangedSince: boolean;
  ageMinutes: number;
  /** A newer snapshot is being built. */
  refreshing: boolean;
  /** Compressed size in bytes. */
  archiveBytes: number;
  manifest: WorkSnapshotManifest;
  /** Present only when requested. */
  download: WorkSnapshotDownload | null;
}

/** The outcome of ensuring a work's snapshot. */
export type WorkSnapshotStatus =
  | ReadyWorkSnapshot
  | { status: 'generating'; retryAfterSeconds: number }
  | { status: 'failed'; error: string; retryAfterSeconds: number }
  | { status: 'not-found' }
  | { status: 'error'; error: string };

/** A snapshot's files keyed by their path under the root. */
export type WorkSnapshotFiles = ReadonlyMap<string, string>;

/**
 * The host's side of the snapshot tools. `ensure` must authorize the caller
 * (`editor.read`) on every call; the tools call it before every read, including
 * reads served from memory.
 */
export interface WorkSnapshotSource {
  /** Ensure the work's snapshot; sign a download URL only when `download` is set. */
  ensure(
    work: string,
    options?: { download?: boolean },
  ): Promise<WorkSnapshotStatus>;
  /**
   * The files of a snapshot already ensured, from memory when cached. May load
   * a newer snapshot of the same work, so use the one returned. Null when the
   * files cannot be loaded.
   */
  files(
    snapshot: ReadyWorkSnapshot,
  ): Promise<{ snapshot: ReadyWorkSnapshot; files: WorkSnapshotFiles } | null>;
}
