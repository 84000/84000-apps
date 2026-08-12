/**
 * Node entry point: the same storage library, outside the browser.
 *
 * For a local-first agent process — Claude Desktop, Codex — which cannot reach
 * the browser's OPFS and so keeps its own store, syncing through the same
 * server substrate as the tabs.
 *
 * It shares `LocalDatabase` with the browser build, so the schema, the journal
 * checksums, the integrity sweep and the full-text index are the same code, not
 * a reimplementation. Only the driver differs.
 *
 * Kept on a separate subpath so `node:sqlite` and `node:fs` never reach a
 * browser bundle.
 */

import { LocalDatabase } from './lib/worker/database';
import { createNodeDriver } from './lib/node/node-driver';

export { createNodeDriver } from './lib/node/node-driver';
export { LocalDatabase } from './lib/worker/database';
export type { SqlDriver } from './lib/driver';
export { crc32, verifyChecksum } from './lib/checksum';
export {
  DatabaseNotOpenError,
  JournalMigrationRequiredError,
  PersistenceError,
  SchemaTooNewError,
} from './lib/errors';
export {
  FTS_TOKENIZER,
  JOURNAL_LAST_CHANGED_AT,
  SCHEMA_STATEMENTS,
  SCHEMA_VERSION,
} from './lib/schema';
export type * from './lib/types';

/**
 * Open a local database at `filePath`.
 *
 * Resolves once the schema is applied and the integrity check has run, exactly
 * as in the browser.
 */
export const openLocalDatabase = async (
  filePath: string,
): Promise<LocalDatabase> => {
  const db = new LocalDatabase(async () => createNodeDriver(filePath));
  await db.open();
  return db;
};
