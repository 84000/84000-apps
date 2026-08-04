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
 * Deliberately holds no database state. If the browser ever restarts it, the
 * tabs re-announce and the directory rebuilds itself.
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
const forget = (clientId: string) => {
  clients.delete(clientId);
  if (ownerId === clientId) {
    ownerId = null;
    broadcast({ type: 'owner-changed', ownerId: null });
  }
};

/**
 * Detect a tab's death by waiting for its liveness lock.
 *
 * Each tab holds an exclusive lock named after itself for as long as it lives.
 * A `MessagePort` gives no close event and a killed tab runs no cleanup code,
 * so this is the only signal that works when a tab is crashed rather than
 * closed politely — which is precisely the case the durability tests exercise.
 */
const watchLiveness = (clientId: string) => {
  navigator.locks
    ?.request(clientLockName(clientId), () => {
      // Granted only once the tab released it, i.e. the tab is gone.
      forget(clientId);
    })
    .catch((error) => {
      console.error('lib-persistence: liveness watch failed', error);
    });
};

const handleMessage = (message: ClientMessage, port: MessagePort) => {
  switch (message.type) {
    case 'hello': {
      const client = { id: message.clientId, port };
      clients.set(message.clientId, client);
      watchLiveness(message.clientId);
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

(self as unknown as SharedWorkerGlobalScope).addEventListener(
  'connect',
  (event) => {
    const port = (event as MessageEvent).ports[0];

    port.addEventListener(
      'message',
      (messageEvent: MessageEvent<ClientMessage>) => {
        if (messageEvent.data) handleMessage(messageEvent.data, port);
      },
    );

    port.start();
  },
);
