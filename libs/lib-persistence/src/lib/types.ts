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

/**
 * When to sweep the blob stores against their checksums.
 *
 * The sweep reads the entire database, so it is not something to do casually.
 * `'if-damaged'` runs it only once `PRAGMA integrity_check` has reported a
 * problem; `'always'` is the deliberate diagnostic; `'never'` restricts the check
 * to the journal.
 */
export type BlobSweepMode = 'if-damaged' | 'always' | 'never';

/**
 * Result of the integrity check performed when the database is opened.
 *
 * A database is only fully healthy when `databaseOk` is true, `sweepErrors` and
 * `corruptJournalIds` are empty, and — if `blobsSwept` — `corruptBlobs` too.
 * `databaseOk` alone covers structure, not contents.
 */
export type IntegrityReport = {
  /** `PRAGMA integrity_check` returned "ok". */
  databaseOk: boolean;
  /** Raw rows returned by `PRAGMA integrity_check`, for diagnostics. */
  databaseErrors: string[];
  /**
   * Sweeps that could not be completed, as opposed to sweeps that found damage.
   *
   * A store too damaged to read at all reports here rather than throwing, so one
   * unreadable table cannot hide what the others would have found.
   */
  sweepErrors: string[];
  /** Journal entries whose stored checksum did not match their payload. */
  corruptJournalIds: number[];
  /** Total journal entries examined. Always the whole journal. */
  journalEntriesChecked: number;
  /**
   * Blob records whose stored checksum did not match their payload.
   *
   * Separate from `databaseOk` because `PRAGMA integrity_check` cannot see
   * this: it verifies b-tree structure, not BLOB payload bytes, so a database
   * can be structurally perfect and still hold garbage in an overflow page.
   *
   * Only meaningful when `blobsSwept` is true.
   */
  corruptBlobs: { store: 'passage_docs' | 'spine' | 'cache'; key: string }[];
  /** Total blob records examined. Zero when `blobsSwept` is false. */
  blobRecordsChecked: number;
  /**
   * Whether the blob stores were swept at all.
   *
   * Distinguishes "checked, all clean" from "not looked at" — without it, an
   * empty `corruptBlobs` reads as a clean bill of health the check never gave.
   */
  blobsSwept: boolean;
};

/** What reconciling the file's schema against this build did. */
export type MigrationReport = {
  /** `user_version` found in the file. 0 means this library never wrote it. */
  fromVersion: number;
  /** The version the file is at now. */
  toVersion: number;
  /**
   * Whether the re-fetchable tables were dropped and recreated.
   *
   * The `journal` table is never included — it holds the only copy of unsynced
   * work, so no path in this library drops it.
   */
  rebuilt: boolean;
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
  migration: MigrationReport;
};

/** Rendered passage text, for the offline full-text index. */
export type PassageTextRecord = {
  passageUuid: string;
  workUuid: string;
  text: string;
};

/** One full-text search result. */
export type SearchHit = {
  passageUuid: string;
  workUuid: string;
  /** Matched text with the hit delimited, from FTS5 `snippet()`. */
  snippet: string;
  /** FTS5 `bm25()` relevance. Lower is more relevant. */
  rank: number;
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
  /**
   * Delete exactly the journal entries named, and nothing else.
   *
   * Ids rather than a high-water mark: `journal.id` is one AUTOINCREMENT sequence
   * shared by every passage, so "clear everything through id N" silently takes
   * other passages' interleaved, still-unsynced edits with it. Returns how many
   * rows were removed.
   */
  clearJournal(ids: number[]): Promise<number>;
  journalCount(): Promise<number>;

  putCache(record: Omit<CacheRecord, 'updatedAt'>): Promise<void>;
  getCache(key: string): Promise<CacheRecord | null>;
  evictExpiredCache(now: number): Promise<number>;

  /**
   * Commit a passage doc and clear the journal entries it subsumes in one
   * transaction. This atomicity across stores is the reason for a single
   * engine rather than two.
   *
   * `syncedJournalIds` names the entries the caller read, sent and had
   * acknowledged. No other entry is touched.
   */
  commitSynced(
    record: Omit<PassageDocRecord, 'updatedAt'>,
    syncedJournalIds: number[],
  ): Promise<void>;

  /**
   * Add or replace passage text in the full-text index.
   *
   * Separate from `putPassageDoc` because the doc blob is opaque CRDT state and
   * the index needs rendered text. Readers populate this when caching a work.
   */
  indexPassageText(records: PassageTextRecord[]): Promise<void>;

  /**
   * Full-text search across indexed passages.
   *
   * This is the offline reader's core need, and the capability with no
   * IndexedDB equivalent — ranking, snippets and diacritic folding would all
   * have to be hand-built there.
   */
  searchPassages(query: string, limit?: number): Promise<SearchHit[]>;

  /** Number of passages in the full-text index. */
  indexedPassageCount(): Promise<number>;

  quota(): Promise<QuotaReport>;
  /**
   * Check structural integrity and the journal checksums.
   *
   * Blob stores are swept only per `blobs`, which defaults to `'if-damaged'`,
   * because sweeping them reads the whole database. Blob protection comes from
   * verify-on-read, not from this.
   */
  integrityCheck(blobs?: BlobSweepMode): Promise<IntegrityReport>;
  /**
   * Sweep every blob against its checksum. Costs a full read of the database.
   *
   * The only way to detect overflow-page corruption before the affected record is
   * read, and therefore a deliberate diagnostic rather than a routine check.
   */
  sweepAllBlobs(): Promise<IntegrityReport>;
  /** Raw byte size of the database file, via the SAH pool. */
  databaseSize(): Promise<number>;
};
