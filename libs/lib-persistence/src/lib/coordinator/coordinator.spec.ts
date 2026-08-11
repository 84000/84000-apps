/**
 * Coordinator routing, tested without a browser.
 *
 * Ownership itself is decided by a Web Lock in the tabs, so what this module
 * actually decides is narrower than it looks: who gets told about an owner
 * change, when a queued port is introduced to the owner, and what the directory
 * does when a tab dies. All of that is message routing over ports, and none of it
 * needs OPFS, a real SharedWorker, or a second tab.
 *
 * What these tests cannot reach is everything the routing sits on top of — the
 * lock election, Comlink proxying, and ownership migration across a real tab
 * crash. That was validated by hand and by Playwright during DEV-708; see
 * `README.md`.
 */

import {
  acceptConnection,
  currentOwnerId,
  forget,
  handleMessage,
  resetDirectory,
  setLivenessWatcher,
} from './coordinator.sharedworker';
import type { ClientMessage, CoordinatorMessage } from './protocol';

type Sent = { message: CoordinatorMessage; transfer: Transferable[] };

type FakePort = MessagePort & {
  /** Everything the coordinator posted to this port, in order. */
  sent: Sent[];
  /** Deliver a message as though the tab had sent it. */
  deliver: (message: ClientMessage) => void;
  started: boolean;
};

const fakePort = (): FakePort => {
  const sent: Sent[] = [];
  const listeners: ((event: MessageEvent) => void)[] = [];

  const port = {
    sent,
    started: false,
    postMessage: (message: CoordinatorMessage, transfer: Transferable[] = []) =>
      sent.push({ message, transfer }),
    addEventListener: (_type: string, fn: (event: MessageEvent) => void) =>
      listeners.push(fn),
    start: () => {
      port.started = true;
    },
    close: () => undefined,
    deliver: (message: ClientMessage) => {
      for (const fn of listeners) fn({ data: message } as MessageEvent);
    },
  };

  return port as unknown as FakePort;
};

/** Messages of one type that a port received. */
const received = <T extends CoordinatorMessage['type']>(
  port: FakePort,
  type: T,
) => port.sent.filter((entry) => entry.message.type === type);

describe('coordinator', () => {
  /** Tabs whose death the test will trigger by hand. */
  let deaths: Map<string, () => void>;

  beforeEach(() => {
    resetDirectory();
    deaths = new Map();
    // Node implements Web Locks, and in a test nothing holds a tab's liveness
    // lock, so the real watcher would be granted immediately and evict every
    // client the moment it said hello.
    setLivenessWatcher((clientId, onGone) => deaths.set(clientId, onGone));
  });

  afterEach(() => resetDirectory());

  /** Connect a tab and say hello, as `StorageClient` does on start. */
  const connect = (clientId: string) => {
    const port = fakePort();
    handleMessage({ type: 'hello', clientId }, port);
    return port;
  };

  describe('hello', () => {
    it('tells a newcomer that no owner exists yet', () => {
      const a = connect('a');
      expect(a.sent.map((entry) => entry.message)).toEqual([
        { type: 'owner-changed', ownerId: null },
      ]);
    });

    it('tells a newcomer who the existing owner is', () => {
      connect('a');
      handleMessage({ type: 'claim', clientId: 'a' }, fakePort());

      const b = connect('b');
      expect(b.sent.map((entry) => entry.message)).toEqual([
        { type: 'owner-changed', ownerId: 'a' },
      ]);
    });
  });

  describe('claim', () => {
    it('announces the new owner to every tab', () => {
      const a = connect('a');
      const b = connect('b');

      handleMessage({ type: 'claim', clientId: 'a' }, a);

      expect(currentOwnerId()).toBe('a');
      expect(received(a, 'owner-changed').at(-1)?.message).toEqual({
        type: 'owner-changed',
        ownerId: 'a',
      });
      expect(received(b, 'owner-changed').at(-1)?.message).toEqual({
        type: 'owner-changed',
        ownerId: 'a',
      });
    });
  });

  describe('connect', () => {
    it('hands the port to the owner so its worker can serve it', () => {
      const a = connect('a');
      connect('b');
      handleMessage({ type: 'claim', clientId: 'a' }, a);

      const proxyPort = fakePort();
      handleMessage(
        { type: 'connect', clientId: 'b', port: proxyPort },
        fakePort(),
      );

      const serves = received(a, 'serve');
      expect(serves).toHaveLength(1);
      // The port must be transferred, not copied — the whole point is that the
      // proxy tab's queries reach the owner's worker directly.
      expect(serves[0].transfer).toEqual([proxyPort]);
    });

    it('queues a request made before any owner exists, then introduces it', () => {
      const a = connect('a');
      connect('b');

      const proxyPort = fakePort();
      handleMessage(
        { type: 'connect', clientId: 'b', port: proxyPort },
        fakePort(),
      );
      // Nobody owns the database yet, so there is nobody to introduce it to.
      expect(received(a, 'serve')).toHaveLength(0);

      handleMessage({ type: 'claim', clientId: 'a' }, a);

      const serves = received(a, 'serve');
      expect(serves).toHaveLength(1);
      expect(serves[0].transfer).toEqual([proxyPort]);
    });

    it('drains every queued port on the first claim', () => {
      const a = connect('a');
      const first = fakePort();
      const second = fakePort();
      handleMessage({ type: 'connect', clientId: 'b', port: first }, fakePort());
      handleMessage({ type: 'connect', clientId: 'c', port: second }, fakePort());

      handleMessage({ type: 'claim', clientId: 'a' }, a);

      expect(received(a, 'serve').map((entry) => entry.transfer)).toEqual([
        [first],
        [second],
      ]);
    });

    it('does not re-introduce a drained port on a later claim', () => {
      const a = connect('a');
      const b = connect('b');
      const proxyPort = fakePort();
      handleMessage(
        { type: 'connect', clientId: 'c', port: proxyPort },
        fakePort(),
      );

      handleMessage({ type: 'claim', clientId: 'a' }, a);
      expect(received(a, 'serve')).toHaveLength(1);

      // Ownership moves; the queue was already emptied, so b inherits nothing.
      handleMessage({ type: 'claim', clientId: 'b' }, b);
      expect(received(b, 'serve')).toHaveLength(0);
    });
  });

  describe('a tab dying', () => {
    it('announces the vacancy immediately when the owner goes', () => {
      const a = connect('a');
      const b = connect('b');
      handleMessage({ type: 'claim', clientId: 'a' }, a);

      // Tabs must stop querying a dead worker as soon as possible, and one of
      // them is already blocked on the ownership lock.
      deaths.get('a')?.();

      expect(currentOwnerId()).toBeNull();
      expect(received(b, 'owner-changed').at(-1)?.message).toEqual({
        type: 'owner-changed',
        ownerId: null,
      });
    });

    it('says nothing when a non-owner goes', () => {
      const a = connect('a');
      connect('b');
      handleMessage({ type: 'claim', clientId: 'a' }, a);
      const before = a.sent.length;

      deaths.get('b')?.();

      expect(currentOwnerId()).toBe('a');
      expect(a.sent).toHaveLength(before);
    });

    it('stops addressing a departed tab', () => {
      const a = connect('a');
      const b = connect('b');
      handleMessage({ type: 'claim', clientId: 'a' }, a);

      deaths.get('b')?.();
      const before = b.sent.length;

      // A later announcement must not reach a tab that is gone.
      handleMessage({ type: 'claim', clientId: 'a' }, a);
      expect(b.sent).toHaveLength(before);
    });

    it('survives a tab dying twice', () => {
      const a = connect('a');
      handleMessage({ type: 'claim', clientId: 'a' }, a);

      const onGone = deaths.get('a');
      onGone?.();
      expect(() => onGone?.()).not.toThrow();
      expect(currentOwnerId()).toBeNull();
    });
  });

  describe('acceptConnection', () => {
    it('starts the port and routes messages arriving on it', () => {
      const port = fakePort();
      acceptConnection(port);

      expect(port.started).toBe(true);

      port.deliver({ type: 'hello', clientId: 'a' });
      expect(port.sent.map((entry) => entry.message)).toEqual([
        { type: 'owner-changed', ownerId: null },
      ]);
    });
  });

  describe('a restarted coordinator', () => {
    it('has no memory of tabs that connected to the previous instance', () => {
      // Documented limitation rather than a bug being asserted: the browser can
      // restart a SharedWorker, and no `hello` is re-sent because a MessagePort
      // fires no close event for a tab to notice. The owner tab keeps working —
      // its ownership comes from the Web Lock, and its queries go to its own
      // worker — but proxy tabs are not introduced again until they reload.
      const a = connect('a');
      handleMessage({ type: 'claim', clientId: 'a' }, a);
      expect(currentOwnerId()).toBe('a');

      resetDirectory();

      expect(currentOwnerId()).toBeNull();
      // The previously known owner is now a stranger: a connect request from
      // another tab has nobody to be introduced to and is queued indefinitely.
      const proxyPort = fakePort();
      handleMessage(
        { type: 'connect', clientId: 'b', port: proxyPort },
        fakePort(),
      );
      expect(received(a, 'serve')).toHaveLength(0);
    });
  });

  describe('forget', () => {
    it('is idempotent for an unknown client', () => {
      expect(() => forget('never-connected')).not.toThrow();
      expect(currentOwnerId()).toBeNull();
    });
  });
});
