/**
 * Browser driver: SQLite WASM on the `opfs-sahpool` VFS.
 *
 * Worker-only — it takes OPFS synchronous access handles and must never be
 * imported from the main thread.
 *
 * `opfs-sahpool` is used rather than the plain `opfs` VFS because it needs no
 * COOP/COEP headers; cross-origin isolation breaks the third-party embeds in
 * the reader and studio apps. The cost is that the pool takes *exclusive*
 * access handles, which is what forces one writer per origin — and therefore
 * the whole SharedWorker coordinator.
 */

import type { SAHPoolUtil, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import {
  DATABASE_FILE,
  SQLITE_MODULE_URL,
  VFS_DIRECTORY,
  VFS_NAME,
} from '../schema';
import type { Row, SqlDriver } from '../driver';

type Oo1Db = {
  exec: (opts: unknown) => unknown;
  close: () => void;
  transaction: (fn: () => void) => void;
};

/**
 * Load the SQLite WASM runtime from `public/`, outside the bundler graph.
 *
 * The comment pragmas stop webpack and Turbopack from following the import;
 * see `SQLITE_MODULE_URL` for why the package cannot be bundled at all. The
 * specifier is held in a variable because a literal would be resolved
 * statically despite the pragmas.
 */
const loadSqlite = async (): Promise<Sqlite3Static> => {
  const moduleUrl = SQLITE_MODULE_URL;
  const module = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ moduleUrl
  )) as { default: () => Promise<Sqlite3Static> };
  return module.default();
};

/** A browser driver, plus the pool handle the harness needs to attack it. */
export type OpfsDriver = SqlDriver & {
  /** The SAH pool, for pause/unpause during corruption injection. */
  readonly pool: SAHPoolUtil;
};

/** Install the VFS and open the database. */
export const createOpfsDriver = async (): Promise<OpfsDriver> => {
  const sqlite3 = await loadSqlite();

  const pool = await sqlite3.installOpfsSAHPoolVfs({
    name: VFS_NAME,
    directory: VFS_DIRECTORY,
    // Each database needs slots for itself plus its rollback journal and temp
    // files; the default of 6 is too tight once the harness imports copies.
    initialCapacity: 12,
  });

  let db = new pool.OpfsSAHPoolDb(DATABASE_FILE) as unknown as Oo1Db;

  return {
    name: pool.vfsName,
    pool,
    rows: (sql, bind = []) =>
      db.exec({
        sql,
        bind,
        rowMode: 'array',
        returnValue: 'resultRows',
      }) as Row[],
    run: (sql, bind = []) => {
      db.exec({ sql, bind });
    },
    transaction: (fn) => db.transaction(fn),
    size: async () => (await pool.exportFile(DATABASE_FILE)).byteLength,
    close: () => db.close(),
    // Re-opening after the harness pauses the VFS needs to replace `db` in the
    // closure, so the driver keeps serving the same object to its owner.
    reopen: () => {
      db = new pool.OpfsSAHPoolDb(DATABASE_FILE) as unknown as Oo1Db;
    },
  } as OpfsDriver & { reopen: () => void };
};
