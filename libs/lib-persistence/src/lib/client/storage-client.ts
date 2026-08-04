/**
 * Main-thread entry point to the local storage stack.
 *
 * Every tab constructs one. Exactly one tab becomes the owner — it runs the
 * dedicated worker with the database open — and the rest proxy their queries to
 * it. Callers use the same `StorageApi` either way and are not told which role
 * their tab has, because the role can change underneath them at any moment.
 *
 * The hard part is that ownership migration is invisible to callers. A query
 * issued against a tab that dies mid-flight is retried against the new owner
 * rather than surfacing as an error, since from the user's point of view
 * nothing happened except another window closing.
 */

import * as Comlink from 'comlink';
import {
  clientLockName,
  OWNER_LOCK,
  type CoordinatorMessage,
} from '../coordinator/protocol';
import type { AttachMessage } from '../worker/sqlite.worker';
import type { OpenReport, StorageApi } from '../types';

/** How long a single call may hang before the owner is presumed dead. */
const CALL_TIMEOUT_MS = 10_000;

/** How many times a call is retried across ownership changes. */
const MAX_ATTEMPTS = 3;

/** The role this tab currently holds. */
export type Role = 'owner' | 'proxy' | 'connecting';

/** Observable state, surfaced for the torture harness and for UI badges. */
export type ClientStatus = {
  clientId: string;
  role: Role;
  ownerId: string | null;
  /** Increments on every ownership change this tab observed. */
  generation: number;
  openReport: OpenReport | null;
};

type Session = {
  generation: number;
  api: Comlink.Remote<StorageApi> | StorageApi;
  release: () => void;
};

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `c${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

class TimeoutError extends Error {
  constructor() {
    super('lib-persistence: call timed out; presuming owner is gone');
    this.name = 'TimeoutError';
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/** Factory for the two worker scripts, overridable so apps can bundle them. */
export type WorkerFactories = {
  createDedicatedWorker: () => Worker;
  createSharedWorker: () => SharedWorker;
};

/**
 * Tab-local handle to the shared database.
 *
 * Construct once per tab, `await start()`, then use `api`.
 */
export class StorageClient {
  readonly clientId = randomId();

  #factories: WorkerFactories;
  #shared: SharedWorker | null = null;
  #worker: Worker | null = null;
  #session: Session | null = null;
  #sessionPromise: Promise<Session> | null = null;
  #generation = 0;
  #role: Role = 'connecting';
  #ownerId: string | null = null;
  #openReport: OpenReport | null = null;
  #listeners = new Set<(status: ClientStatus) => void>();

  constructor(factories: WorkerFactories) {
    this.#factories = factories;
  }

  get status(): ClientStatus {
    return {
      clientId: this.clientId,
      role: this.#role,
      ownerId: this.#ownerId,
      generation: this.#generation,
      openReport: this.#openReport,
    };
  }

  /** Subscribe to role/ownership changes. Returns an unsubscribe function. */
  subscribe(listener: (status: ClientStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    const status = this.status;
    for (const listener of this.#listeners) listener(status);
  }

  /**
   * Join the tab group and begin competing for ownership.
   *
   * Resolves as soon as this tab can serve queries — as owner or as proxy —
   * not when it becomes the owner, which may never happen.
   */
  async start(): Promise<void> {
    this.#holdLivenessLock();
    this.#connectCoordinator();
    this.#competeForOwnership();
    await this.#ready();
  }

  /**
   * Hold a lock named after this tab for as long as the tab lives.
   *
   * The coordinator waits on it to detect this tab's death. The promise is
   * intentionally never awaited and never resolves until the tab is gone.
   */
  #holdLivenessLock() {
    navigator.locks
      ?.request(
        clientLockName(this.clientId),
        () => new Promise<never>(() => undefined),
      )
      .catch(() => undefined);
  }

  #connectCoordinator() {
    const shared = this.#factories.createSharedWorker();
    this.#shared = shared;

    shared.port.addEventListener(
      'message',
      (event: MessageEvent<CoordinatorMessage>) => {
        const message = event.data;
        if (message.type === 'serve') {
          // A proxy tab wants to talk to our worker; hand the port straight to
          // it so its queries bypass this main thread entirely.
          this.#worker?.postMessage(
            { type: 'attach', port: message.port } satisfies AttachMessage,
            [message.port],
          );
          return;
        }
        if (message.type === 'owner-changed') {
          this.#onOwnerChanged(message.ownerId);
        }
      },
    );

    shared.port.start();
    shared.port.postMessage({ type: 'hello', clientId: this.clientId });
  }

  /**
   * Queue for the ownership lock.
   *
   * Whoever holds it owns the database. The request stays pending in every
   * non-owner tab, so a handoff needs no coordination: when the owner's tab
   * dies the browser releases the lock and grants it to the next waiter.
   */
  #competeForOwnership() {
    navigator.locks
      ?.request(OWNER_LOCK, async () => {
        await this.#becomeOwner();
        // Hold the lock — and therefore ownership — for the tab's lifetime.
        await new Promise<never>(() => undefined);
      })
      .catch((error) => {
        console.error('lib-persistence: ownership request failed', error);
      });
  }

  async #becomeOwner() {
    const worker = this.#factories.createDedicatedWorker();
    this.#worker = worker;

    const channel = new MessageChannel();
    worker.postMessage(
      { type: 'attach', port: channel.port2 } satisfies AttachMessage,
      [channel.port2],
    );
    const api = Comlink.wrap<StorageApi>(channel.port1);

    this.#openReport = await api.open();

    this.#role = 'owner';
    this.#installSession({
      generation: ++this.#generation,
      api,
      release: () => channel.port1.close(),
    });

    this.#shared?.port.postMessage({ type: 'claim', clientId: this.clientId });
    this.#emit();
  }

  /**
   * React to the coordinator announcing a different owner.
   *
   * The current session is torn down so that in-flight calls fail fast and
   * `#invoke` can retry them against whoever is authoritative now.
   */
  #onOwnerChanged(ownerId: string | null) {
    this.#ownerId = ownerId;

    if (ownerId === this.clientId) {
      this.#emit();
      return;
    }

    // We are not the owner. Drop any session pointed at the old one.
    this.#teardownSession();
    this.#role = ownerId ? 'proxy' : 'connecting';
    this.#emit();
  }

  #installSession(session: Session) {
    this.#session = session;
    this.#sessionPromise = Promise.resolve(session);
  }

  /**
   * Discard the current session.
   *
   * An owner tab keeps its own worker and session — it is the authority, so a
   * coordinator announcement never invalidates it. Only a proxy session, which
   * points at another tab, is disposable.
   */
  #teardownSession() {
    if (this.#role === 'owner') return;
    this.#session?.release();
    this.#session = null;
    this.#sessionPromise = null;
  }

  /** Open a proxy channel to the current owner via the coordinator. */
  async #connectToOwner(): Promise<Session> {
    const channel = new MessageChannel();
    this.#shared?.port.postMessage(
      { type: 'connect', clientId: this.clientId, port: channel.port2 },
      [channel.port2],
    );
    const api = Comlink.wrap<StorageApi>(channel.port1);
    return {
      generation: ++this.#generation,
      api,
      release: () => channel.port1.close(),
    };
  }

  /** Resolve to a usable session, waiting for an owner to exist if needed. */
  async #ready(): Promise<Session> {
    if (this.#sessionPromise) return this.#sessionPromise;

    const promise = (async () => {
      // If nobody owns the database yet, the coordinator queues our port and
      // introduces us the moment somebody claims it, so we can connect blind.
      const session = await this.#connectToOwner();
      this.#session = session;
      if (this.#role === 'connecting') this.#role = 'proxy';
      this.#emit();
      return session;
    })();

    this.#sessionPromise = promise;
    return promise;
  }

  /**
   * Run one storage call, retrying across ownership migration.
   *
   * A call is retried when the session it ran on is no longer current — either
   * because the coordinator announced a new owner, or because the call hung
   * long enough that the owner is presumed dead.
   *
   * Retrying is safe because of what the payloads are, not because the calls
   * are transactional: the writes are last-write-wins upserts, and a journal
   * entry carries a Yjs update, which is idempotent when applied. A duplicated
   * append therefore replays harmlessly, while a dropped one loses work — so
   * this retries rather than surfacing the error.
   */
  async #invoke<T>(fn: (api: StorageApi) => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const session = await this.#ready();
      try {
        return await withTimeout(
          fn(session.api as StorageApi),
          CALL_TIMEOUT_MS,
        );
      } catch (error) {
        lastError = error;

        const migrated = session.generation !== this.#generation;
        const timedOut = error instanceof TimeoutError;
        if (!migrated && !timedOut) throw error;

        // Force a fresh session on the next attempt. An owner tab keeps its
        // own worker, so only a proxy session is discarded here.
        if (this.#role !== 'owner') {
          session.release();
          this.#session = null;
          this.#sessionPromise = null;
        }
      }
    }

    throw lastError;
  }

  /** The storage operations, transparently local or proxied. */
  readonly api: StorageApi = {
    open: () => this.#invoke((a) => a.open()),
    close: () => this.#invoke((a) => a.close()),
    putPassageDoc: (record) => this.#invoke((a) => a.putPassageDoc(record)),
    putPassageDocs: (records) => this.#invoke((a) => a.putPassageDocs(records)),
    getPassageDoc: (uuid) => this.#invoke((a) => a.getPassageDoc(uuid)),
    putSpine: (record) => this.#invoke((a) => a.putSpine(record)),
    getSpine: (workUuid) => this.#invoke((a) => a.getSpine(workUuid)),
    appendJournal: (entry) => this.#invoke((a) => a.appendJournal(entry)),
    readJournal: (limit) => this.#invoke((a) => a.readJournal(limit)),
    clearJournal: (upToId) => this.#invoke((a) => a.clearJournal(upToId)),
    journalCount: () => this.#invoke((a) => a.journalCount()),
    putCache: (record) => this.#invoke((a) => a.putCache(record)),
    getCache: (key) => this.#invoke((a) => a.getCache(key)),
    evictExpiredCache: (now) => this.#invoke((a) => a.evictExpiredCache(now)),
    commitSynced: (record, upToId) =>
      this.#invoke((a) => a.commitSynced(record, upToId)),
    indexPassageText: (records) =>
      this.#invoke((a) => a.indexPassageText(records)),
    searchPassages: (query, limit) =>
      this.#invoke((a) => a.searchPassages(query, limit)),
    indexedPassageCount: () => this.#invoke((a) => a.indexedPassageCount()),
    quota: () => this.#invoke((a) => a.quota()),
    integrityCheck: () => this.#invoke((a) => a.integrityCheck()),
    databaseSize: () => this.#invoke((a) => a.databaseSize()),
  };
}
