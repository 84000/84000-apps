/**
 * The narrow seam between the storage logic and the SQLite engine underneath.
 *
 * Everything above this interface — the schema, every statement, the journal
 * checksums, the integrity sweep — is shared. Only connecting to a database
 * differs between environments, and that difference is two small files:
 *
 * - `worker/opfs-driver.ts`: `@sqlite.org/sqlite-wasm` on the `opfs-sahpool`
 *   VFS, in a browser worker.
 * - `node/node-driver.ts`: `node:sqlite` against a file, for a local agent
 *   process running outside the browser (Claude Desktop, Codex).
 *
 * This seam is the reason the project can have one persistence library rather
 * than two. It is deliberately tiny — if it grows, the two environments have
 * started to diverge and the claim stops being true.
 */

/** A row returned as an array of column values. */
export type Row = unknown[];

/** A connected SQLite database. */
export type SqlDriver = {
  /** Run a statement and return its rows as arrays. */
  rows(sql: string, bind?: unknown[]): Row[];

  /** Run a statement for effect. */
  run(sql: string, bind?: unknown[]): void;

  /**
   * Run `fn` inside a transaction, rolling back if it throws.
   *
   * Synchronous by necessity: both engines expose synchronous statement
   * execution, and an `await` inside a transaction would let unrelated work
   * interleave with it.
   */
  transaction(fn: () => void): void;

  /** Size of the database in bytes. */
  size(): Promise<number>;

  close(): void;

  /** Identifies the backing store in reports, e.g. `opfs-sahpool` or `node`. */
  readonly name: string;
};
