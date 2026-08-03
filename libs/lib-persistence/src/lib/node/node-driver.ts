/**
 * Node driver: `node:sqlite` against a file on disk.
 *
 * This exists for the third local-first peer — an agent running in Claude
 * Desktop, Codex or similar. It cannot reach the browser's OPFS, so it keeps
 * its own store and syncs through the same server substrate as the tabs.
 *
 * The point of this file is how small it is. Everything that matters — the
 * schema, the journal checksums, the integrity sweep, every statement — is
 * shared with the browser. Only connecting differs.
 *
 * Node-only: it must not be imported from browser code, which is why it sits
 * behind the `@eightyfourthousand/lib-persistence/node` subpath rather than the
 * main barrel.
 */

import { DatabaseSync } from 'node:sqlite';
import { statSync } from 'node:fs';
import type { Row, SqlDriver } from '../driver';

/** Open (or create) a local database file. */
export const createNodeDriver = (filePath: string): SqlDriver => {
  const db = new DatabaseSync(filePath);

  return {
    name: 'node',
    rows: (sql, bind = []) => {
      const stmt = db.prepare(sql);
      // Match the browser driver's array row mode so callers are identical.
      const objectRows = stmt.all(...(bind as never[])) as Record<
        string,
        unknown
      >[];
      return objectRows.map((row) => Object.values(row) as Row);
    },
    run: (sql, bind = []) => {
      if (bind.length) db.prepare(sql).run(...(bind as never[]));
      else db.exec(sql);
    },
    transaction: (fn) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    size: async () => {
      try {
        return statSync(filePath).size;
      } catch {
        // ':memory:' and friends have no file.
        return 0;
      }
    },
    close: () => db.close(),
  };
};
