/**
 * Typed failures for the cases where returning `null` would be dangerous.
 *
 * The repo convention is to return `null` and log rather than throw, and this
 * library follows it for *reads*: a record that fails its checksum is withheld,
 * because `null` means "not available locally" and every caller already handles
 * that by re-fetching. Silence is the correct behaviour there.
 *
 * These errors cover the opposite case — a database that cannot be trusted to be
 * read or written at all. Swallowing one of those would let the editor run
 * against a store that is absent, stale, or written by code that understood the
 * schema differently, and the first symptom would be lost work rather than a
 * failed call. So they throw, loudly, and the caller decides.
 */

/** Base class for every failure this library raises deliberately. */
export class PersistenceError extends Error {
  constructor(message: string) {
    super(`lib-persistence: ${message}`);
    this.name = new.target.name;
  }
}

/**
 * A storage operation was attempted before `open()` succeeded.
 *
 * Almost always a lifecycle bug in the caller rather than a storage fault.
 */
export class DatabaseNotOpenError extends PersistenceError {
  constructor() {
    super('database is not open');
  }
}

/**
 * The database file was written by a newer build than this one.
 *
 * This is not migratable — forward migration would require knowing what a future
 * schema means. It happens in practice when a tab stays open across a deploy and
 * a reloaded tab has already upgraded the shared database.
 *
 * Deliberately *not* handled by rebuilding: the newer file may hold journal
 * entries in a shape this build cannot read, and discarding a translator's
 * unsynced work to resolve a version mismatch is the one outcome this library
 * exists to prevent. The caller should tell the user to reload.
 */
export class SchemaTooNewError extends PersistenceError {
  constructor(
    readonly foundVersion: number,
    readonly supportedVersion: number,
  ) {
    super(
      `database schema is version ${foundVersion} but this build supports ` +
        `${supportedVersion}; reload the page to get the newer build`,
    );
  }
}

/**
 * An older database needs a change to the `journal` table itself.
 *
 * Every other table is a cache of server state, so the recovery path for a stale
 * schema is to drop and re-fetch. The journal is not — it is the only copy of
 * unsynced work, so it can never be rebuilt from elsewhere. A version step that
 * alters it therefore needs a hand-written migration, and until one is
 * registered this is a hard stop rather than a silent data loss.
 */
export class JournalMigrationRequiredError extends PersistenceError {
  constructor(
    readonly fromVersion: number,
    readonly toVersion: number,
  ) {
    super(
      `migrating the journal from version ${fromVersion} to ${toVersion} ` +
        `needs a hand-written migration, which is not registered`,
    );
  }
}
