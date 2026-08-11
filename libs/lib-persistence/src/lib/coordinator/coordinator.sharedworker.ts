/// <reference lib="webworker" />
/**
 * SharedWorker coordinator: the directory of which tab owns the database.
 *
 * Ownership itself is decided by a Web Lock held in the tabs, not here — the
 * lock is what makes the handoff correct, because the browser releases it even
 * if the owning tab is killed without running any cleanup code. This worker
 * exists to do what a lock cannot: introduce tabs to each other and tell them
 * when the owner changed.
 *
 * Deliberately holds no database state — but note that it does **not** currently
 * rebuild its directory if the browser restarts it. A `MessagePort` fires no
 * close event, so a tab cannot tell that its coordinator port has gone dead, and
 * nothing re-sends `hello`.
 *
 * The consequence is bounded: the owner tab keeps working, because its ownership
 * comes from the Web Lock rather than from here, and its queries go straight to
 * its own worker. Proxy tabs stop being introduced to the owner until they
 * reload. Closing that gap needs a liveness heartbeat on the coordinator port and
 * is deliberately left to a follow-up.
 */

import {
  clientLockName,
  type ClientMessage,
  type CoordinatorMessage,
} from './protocol';

type Client = { id: string; port: MessagePort };

const clients = new Map<string, Client>();
let ownerId: string | null = null;

/** Ports waiting for an owner to exist, so their tabs can be introduced. */
const pending: MessagePort[] = [];

/**
 * Discard all directory state.
 *
 * Exists for tests, which need each case to start from an empty directory — the
 * module's state is top-level, so importing it once per file would otherwise leak
 * clients between cases.
 */
export const resetDirectory = (): void => {
  clients.clear();
  pending.length = 0;
  ownerId = null;
  livenessWatcher = lockLivenessWatcher;
};

/** The current owner, for assertions in tests. */
export const currentOwnerId = (): string | null => ownerId;

const post = (
  client: Client,
  message: CoordinatorMessage,
  transfer?: Transferable[],
) => {
  try {
    client.port.postMessage(message, transfer ?? []);
  } catch (error) {
    console.error('lib-persistence: coordinator post failed', error);
  }
};

const broadcast = (message: CoordinatorMessage) => {
  for (const client of clients.values()) post(client, message);
};

/** Hand a client's port to the owning tab so its worker can serve it. */
const introduce = (port: MessagePort) => {
  const owner = ownerId ? clients.get(ownerId) : undefined;
  if (!owner) {
    pending.push(port);
    return;
  }
  post(owner, { type: 'serve', port }, [port]);
};

/**
 * Drop a departed client.
 *
 * If it was the owner, announce the vacancy immediately rather than waiting for
 * the next claim: tabs must stop issuing queries against a dead worker as soon
 * as possible, and one of them is already blocked on the ownership lock.
 */
export const forget = (clientId: string) => {
  clients.delete(clientId);
  if (ownerId === clientId) {
    ownerId = null;
    broadcast({ type: 'owner-changed', ownerId: null });
  }
};

/**
 * Called with a tab's id and a callback to run once that tab is gone.
 *
 * A seam rather than a direct call because waiting on a Web Lock only means
 * "the tab died" when something is actually holding that lock. In a browser the
 * tab holds it for its whole lifetime; in a test nothing does, so the request
 * would be granted immediately and every client would be evicted the moment it
 * said hello. Tests substitute their own watcher and drive death explicitly.
 */
export type LivenessWatcher = (clientId: string, onGone: () => void) => void;

/**
 * Detect a tab's death by waiting for its liveness lock.
 *
 * Each tab holds an exclusive lock named after itself for as long as it lives.
 * A `MessagePort` gives no close event and a killed tab runs no cleanup code,
 * so this is the only signal that works when a tab is crashed rather than
 * closed politely — which is precisely the case the durability tests exercise.
 */
const lockLivenessWatcher: LivenessWatcher = (clientId, onGone) => {
  navigator.locks
    ?.request(clientLockName(clientId), () => {
      // Granted only once the tab released it, i.e. the tab is gone.
      onGone();
    })
    .catch((error) => {
      console.error('lib-persistence: liveness watch failed', error);
    });
};

let livenessWatcher: LivenessWatcher = lockLivenessWatcher;

/** Substitute the liveness watcher. For tests; production uses the Web Lock. */
export const setLivenessWatcher = (watcher: LivenessWatcher): void => {
  livenessWatcher = watcher;
};

/**
 * Route one message from a tab.
 *
 * Exported so the routing can be tested directly against fake ports. Everything
 * this coordinator does that is worth asserting — who gets told about an owner
 * change, when a queued port is introduced, what happens to the directory when a
 * tab dies — is decided here, and none of it needs a real browser.
 */
export const handleMessage = (message: ClientMessage, port: MessagePort) => {
  switch (message.type) {
    case 'hello': {
      const client = { id: message.clientId, port };
      clients.set(message.clientId, client);
      livenessWatcher(message.clientId, () => forget(message.clientId));
      // Tell the newcomer who is in charge; null means "election in progress".
      post(client, { type: 'owner-changed', ownerId });
      break;
    }

    case 'claim': {
      ownerId = message.clientId;
      broadcast({ type: 'owner-changed', ownerId });
      // Anyone who asked for a connection before an owner existed gets one now.
      while (pending.length) {
        const waiting = pending.shift();
        if (waiting) introduce(waiting);
      }
      break;
    }

    case 'connect': {
      introduce(message.port);
      break;
    }
  }
};

/**
 * Accept a new tab's port.
 *
 * Split out from the listener registration so the same wiring can be driven
 * directly by a test that has no `SharedWorkerGlobalScope` to dispatch on.
 */
export const acceptConnection = (port: MessagePort): void => {
  port.addEventListener(
    'message',
    (messageEvent: MessageEvent<ClientMessage>) => {
      if (messageEvent.data) handleMessage(messageEvent.data, port);
    },
  );

  port.start();
};

// Guarded because this module is also imported by unit tests running in Node,
// where there is no `self` to register on. In a SharedWorker this is the entry
// point; everywhere else the exports above are the whole module.
if (typeof self !== 'undefined') {
  (self as unknown as SharedWorkerGlobalScope).addEventListener(
    'connect',
    (event) => {
      acceptConnection((event as MessageEvent).ports[0]);
    },
  );
}
