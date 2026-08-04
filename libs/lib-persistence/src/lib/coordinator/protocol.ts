/**
 * Wire protocol between tabs and the SharedWorker coordinator.
 *
 * The coordinator is a directory, not a database proxy: it knows which tab owns
 * the database and introduces other tabs to it. Data never flows through it.
 */

/** Sent by a tab immediately after connecting. */
export type HelloMessage = { type: 'hello'; clientId: string };

/** Sent by a tab once it has won the ownership lock and opened its worker. */
export type ClaimMessage = { type: 'claim'; clientId: string };

/**
 * Sent by a tab that wants to talk to the current owner.
 *
 * The coordinator forwards the enclosed port to the owner, which hands it to
 * its dedicated worker. If there is no owner yet the request is queued until
 * one claims ownership.
 */
export type ConnectMessage = {
  type: 'connect';
  clientId: string;
  port: MessagePort;
};

/** Tab to coordinator. */
export type ClientMessage = HelloMessage | ClaimMessage | ConnectMessage;

/** Coordinator to owning tab: serve this port. */
export type ServeMessage = { type: 'serve'; port: MessagePort };

/**
 * Coordinator to all tabs: ownership changed.
 *
 * Tabs use this to discard proxies pointing at the previous owner and
 * re-connect. `ownerId` is null while an election is in flight.
 */
export type OwnerChangedMessage = {
  type: 'owner-changed';
  ownerId: string | null;
};

/** Coordinator to tab. */
export type CoordinatorMessage = ServeMessage | OwnerChangedMessage;

/** Name of the Web Lock that confers database ownership. */
export const OWNER_LOCK = '84000-local-storage-owner';

/**
 * Name of the per-tab liveness lock.
 *
 * Each tab holds this for its whole lifetime; the coordinator waits on it to
 * learn that the tab is gone. This works for a crashed tab, where no cleanup
 * code runs and no port event fires.
 */
export const clientLockName = (clientId: string): string =>
  `84000-local-storage-client-${clientId}`;
