/**
 * Shared types for the browser-local storage stack.
 *
 * The stack has three layers, and these types are the contract between them:
 * a dedicated SQLite worker (owns the database), a SharedWorker coordinator
 * (decides which tab's worker is authoritative), and a main-thread client in
 * each tab (talks to whichever worker currently owns the database).
 */

/** A passage document blob plus the version it was derived from. */
export type PassageDocRecord = {
  uuid: string;
  workUuid: string;
  /** Encoded Yjs document state. Opaque to this layer. */
  doc: Uint8Array;
  /** Monotonic per-passage version, used for divergence detection. */
  version: number;
  updatedAt: number;
};

/** The ordered passage list for a work. */
export type SpineRecord = {
  workUuid: string;
  /** Encoded spine document (ordered passage uuids, labels, types). */
  doc: Uint8Array;
  version: number;
  updatedAt: number;
};

/**
 * One unsynced local edit.
 *
 * This is the durability-critical table: while offline it is the only copy of
 * the user's work. Every entry carries a checksum over its own payload so a
 * torn or corrupted write is detectable rather than silently replayed.
 */
export type JournalEntry = {
  id: number;
  passageUuid: string;
  workUuid: string;
  /** Encoded Yjs update to replay against the passage doc. */
  update: Uint8Array;
  /** Checksum over `update`, verified on read. */
  checksum: number;
  createdAt: number;
};

/** A journal entry before it has been assigned a rowid. */
export type JournalAppend = Omit<JournalEntry, 'id' | 'checksum' | 'createdAt'>;

/** A cached server response, evictable under quota pressure. */
export type CacheRecord = {
  key: string;
  body: Uint8Array;
  /** Absolute epoch-ms expiry. */
  expiresAt: number;
  updatedAt: number;
};

/** Result of the integrity check performed when the database is opened. */
export type IntegrityReport = {
  /** `PRAGMA integrity_check` returned "ok". */
  databaseOk: boolean;
  /** Raw rows returned by `PRAGMA integrity_check`, for diagnostics. */
  databaseErrors: string[];
  /** Journal entries whose stored checksum did not match their payload. */
  corruptJournalIds: number[];
  /** Total journal entries examined. */
  journalEntriesChecked: number;
};

/** Outcome of opening the database. */
export type OpenReport = {
  /** Milliseconds from worker start to a queryable database. */
  coldOpenMs: number;
  /** Whether `navigator.storage.persist()` reports the origin as persisted. */
  persisted: boolean;
  /** Whether the SAH pool VFS installed successfully. */
  vfsName: string;
  integrity: IntegrityReport;
};

/** Storage usage as reported by the Storage Manager API. */
export type QuotaReport = {
  usage: number;
  quota: number;
  persisted: boolean;
};

/**
 * The database operations exposed by the SQLite worker.
 *
 * The same interface is used locally (owner tab) and remotely (proxied from an
 * inactive tab through the coordinator), so callers cannot tell the difference.
 */
export type StorageApi = {
  open(): Promise<OpenReport>;
  close(): Promise<void>;

  putPassageDoc(record: Omit<PassageDocRecord, 'updatedAt'>): Promise<void>;
  /**
   * Write many passage docs in a single transaction.
   *
   * This is how a work is cached on first visit. Doing it one statement at a
   * time pays an fsync per row under `synchronous = FULL`, which is the right
   * cost for an edit that must be durable immediately and the wrong cost for a
   * bulk load that can be redone by re-fetching.
   */
  putPassageDocs(records: Omit<PassageDocRecord, 'updatedAt'>[]): Promise<void>;
  getPassageDoc(uuid: string): Promise<PassageDocRecord | null>;
  putSpine(record: Omit<SpineRecord, 'updatedAt'>): Promise<void>;
  getSpine(workUuid: string): Promise<SpineRecord | null>;

  appendJournal(entry: JournalAppend): Promise<number>;
  /**
   * Read journal entries, verifying each checksum.
   *
   * Entries that fail verification are reported separately rather than
   * returned, so a corrupt entry can never be silently replayed as if valid.
   */
  readJournal(limit?: number): Promise<{
    entries: JournalEntry[];
    corruptIds: number[];
  }>;
  clearJournal(upToId: number): Promise<number>;
  journalCount(): Promise<number>;

  putCache(record: Omit<CacheRecord, 'updatedAt'>): Promise<void>;
  getCache(key: string): Promise<CacheRecord | null>;
  evictExpiredCache(now: number): Promise<number>;

  /**
   * Commit a passage doc and clear the journal entries it subsumes in one
   * transaction. This atomicity across stores is the reason for a single
   * engine rather than two.
   */
  commitSynced(
    record: Omit<PassageDocRecord, 'updatedAt'>,
    clearJournalUpToId: number,
  ): Promise<void>;

  quota(): Promise<QuotaReport>;
  integrityCheck(): Promise<IntegrityReport>;
  /** Raw byte size of the database file, via the SAH pool. */
  databaseSize(): Promise<number>;
};

/**
 * Destructive operations that exist only to attack the storage layer.
 *
 * Kept off `StorageApi` so nothing in the editor can reach them by accident,
 * and so the production surface stays honest about what it offers. This is
 * spike scaffolding (DEV-708) and should not survive into DEV-562's lib unless
 * the torture tests become a permanent regression suite.
 */
export type DebugApi = {
  /**
   * Overwrite a journal entry's payload without updating its checksum.
   *
   * Simulates corruption that leaves the database structurally valid, which
   * `PRAGMA integrity_check` cannot see.
   */
  corruptJournalEntry(id: number, payload: Uint8Array): Promise<void>;

  /**
   * Release the SAH pool's access handles so OPFS files can be opened writable
   * from outside SQLite. The database is closed first.
   */
  pauseVfs(): Promise<void>;

  /** Re-acquire access handles and re-open the database after `pauseVfs`. */
  unpauseVfs(): Promise<IntegrityReport>;

  /** Delete every row in every store. */
  wipe(): Promise<void>;
};
