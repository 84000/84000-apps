import { Doc, applyUpdate, encodeStateAsUpdate, mergeUpdates } from 'yjs';

import { fromBase64, toBase64 } from './encoding';
import type { PresenceConfig } from './presence';
import type {
  EncodedUpdate,
  SyncMode,
  SyncSubscription,
  SyncTransport,
} from './types';

export type PassageSyncStatus = 'idle' | 'connecting' | 'live' | 'closed';

export type LatencySample = {
  /** Milliseconds from local flush to the same update arriving back. */
  roundTripMs: number;
  mode: SyncMode;
};

export type PassageSyncOptions = {
  doc: Doc;
  workUuid: string;
  passageUuid: string;
  transport: SyncTransport;
  /**
   * Coalescing window. 300ms is the issue's starting point; at the expected
   * 2–4 concurrent editors nothing about throughput forces it lower, and the
   * spike's fallback ladder starts by widening it.
   */
  flushMs?: number;
  mode?: SyncMode;
  /** Identifies this provider instance so it can drop its own echo. */
  clientId?: string;
  onStatusChange?: (status: PassageSyncStatus) => void;
  onLatencySample?: (sample: LatencySample) => void;
  onError?: (error: unknown) => void;
  /**
   * Who's-here and cursors. Configured here rather than joined separately
   * because presence shares the document's channel and its callbacks must be
   * registered before that channel subscribes — see `presence.ts`.
   */
  presence?: PresenceConfig;
};

const randomClientId = (): string => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Keeps one passage's Yjs document in sync with the server.
 *
 * Local edits are coalesced over `flushMs` and appended to
 * `passage_doc_updates`; a Postgres trigger relays the append to the passage's
 * Realtime channel, and remote appends arrive there and are applied locally.
 *
 * Three things carry the correctness of this, and all three are properties of
 * Yjs rather than of the transport:
 *
 * 1. **Idempotent apply.** Re-applying an update the document already has is a
 *    no-op, so a duplicated broadcast costs nothing and catch-up is free to
 *    re-read more than it needs.
 * 2. **Commutative merge.** Updates converge in any order, so the relay does
 *    not have to preserve one, and a message that overtakes another is fine.
 * 3. **Mergeable updates.** A flush window's worth of keystrokes merges into a
 *    single update, so the log grows per flush rather than per keystroke.
 *
 * What is *not* free is the join ordering — see `connect`.
 */
export class PassageSyncProvider {
  readonly clientId: string;

  private readonly doc: Doc;
  private readonly workUuid: string;
  private readonly passageUuid: string;
  private readonly transport: SyncTransport;
  private readonly flushMs: number;
  private readonly mode: SyncMode;
  private readonly onStatusChange?: (status: PassageSyncStatus) => void;
  private readonly onLatencySample?: (sample: LatencySample) => void;
  private readonly onError?: (error: unknown) => void;
  private readonly presence?: PresenceConfig;

  private pending: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushChain: Promise<void> = Promise.resolve();
  private subscription: SyncSubscription | null = null;
  private status: PassageSyncStatus = 'idle';

  /**
   * Base64 of updates this instance sent, mapped to when they were sent, so a
   * returning echo yields a round-trip measurement and is then dropped.
   * Dropping is an optimisation — applying your own update again is a no-op —
   * but the timing is the point of the `trigger` vs `direct` comparison.
   */
  private readonly inFlight = new Map<string, number>();

  constructor(options: PassageSyncOptions) {
    this.doc = options.doc;
    this.workUuid = options.workUuid;
    this.passageUuid = options.passageUuid;
    this.transport = options.transport;
    this.flushMs = options.flushMs ?? 300;
    this.mode = options.mode ?? 'trigger';
    this.clientId = options.clientId ?? randomClientId();
    this.onStatusChange = options.onStatusChange;
    this.onLatencySample = options.onLatencySample;
    this.onError = options.onError;
    this.presence = options.presence;

    this.doc.on('update', this.handleLocalUpdate);
  }

  /**
   * Subscribe first, then catch up. The order is load-bearing.
   *
   * Catching up first leaves a window between the read and the subscription in
   * which an append is neither in the response nor on the channel — it is lost
   * to this client until something else happens to resend it, which nothing
   * does. Subscribing first can only *duplicate*: an update may arrive on the
   * channel and again in the catch-up read, which idempotent apply makes free.
   *
   * The asymmetry is the whole reason this is safe to build on a relay that
   * offers no delivery guarantee.
   */
  async connect(): Promise<void> {
    this.setStatus('connecting');

    this.subscription = await this.transport.subscribe({
      passageUuid: this.passageUuid,
      onUpdates: this.handleRemoteUpdates,
      presence: this.presence,
    });

    const state = await this.transport.fetchState(this.passageUuid);

    this.doc.transact(() => {
      if (state.snapshot) {
        applyUpdate(this.doc, fromBase64(state.snapshot.doc), this);
      }
      for (const row of state.updates) {
        applyUpdate(this.doc, fromBase64(row.update), this);
      }
    }, this);

    this.setStatus('live');
  }

  /** Publish this client's cursor. No-op when presence was not configured. */
  async setCursor(cursor: string | null): Promise<void> {
    await this.subscription?.setCursor?.(cursor);
  }

  /** Flush anything buffered and wait for it to land. */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.enqueueFlush();
    await this.flushChain;
  }

  async destroy(): Promise<void> {
    this.doc.off('update', this.handleLocalUpdate);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushChain;
    await this.subscription?.unsubscribe();
    this.subscription = null;
    this.setStatus('closed');
  }

  /**
   * Drop the channel without flushing — the kill-and-reconnect scenario.
   * Buffered edits stay in `pending` and go out on the next flush after
   * `connect`, which is what makes a client that was offline through a burst of
   * concurrent edits converge rather than lose its own work.
   */
  async disconnect(): Promise<void> {
    await this.subscription?.unsubscribe();
    this.subscription = null;
    this.setStatus('idle');
  }

  private setStatus(status: PassageSyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatusChange?.(status);
  }

  private handleLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    // Updates we applied ourselves re-enter here with the provider as origin.
    // Re-sending them would be an echo loop.
    if (origin === this) return;

    this.pending.push(update);
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.enqueueFlush();
    }, this.flushMs);
  };

  private enqueueFlush(): void {
    if (this.pending.length === 0) return;

    // One update per flush, not one per keystroke. This is where the write
    // amplification of the design is actually decided.
    const merged =
      this.pending.length === 1 ? this.pending[0] : mergeUpdates(this.pending);
    this.pending = [];

    this.flushChain = this.flushChain.then(() => this.send(merged));
  }

  private async send(update: Uint8Array): Promise<void> {
    const encoded = toBase64(update);
    this.inFlight.set(encoded, Date.now());

    try {
      await this.transport.append({
        workUuid: this.workUuid,
        passageUuid: this.passageUuid,
        clientId: this.clientId,
        update,
      });

      if (this.mode === 'direct') {
        await this.transport.broadcast?.({
          passageUuid: this.passageUuid,
          clientId: this.clientId,
          update,
        });
      }
    } catch (error) {
      this.inFlight.delete(encoded);
      // The edit is still in the document and still in the local journal; it is
      // the *server* that missed it. Re-queue so the next flush retries rather
      // than silently dropping an edit the user can see on screen.
      this.pending.unshift(update);
      this.onError?.(error);
    }
  }

  private handleRemoteUpdates = (rows: EncodedUpdate[]): void => {
    const foreign: Uint8Array[] = [];

    for (const row of rows) {
      const sentAt = this.inFlight.get(row.update);
      if (sentAt !== undefined) {
        this.inFlight.delete(row.update);
        this.onLatencySample?.({
          roundTripMs: Date.now() - sentAt,
          mode: this.mode,
        });
        continue;
      }
      if (row.clientId === this.clientId) continue;
      foreign.push(fromBase64(row.update));
    }

    if (foreign.length === 0) return;

    // Origin is the provider, so `handleLocalUpdate` ignores the resulting
    // event and these do not bounce back to the server.
    this.doc.transact(() => {
      for (const update of foreign) {
        applyUpdate(this.doc, update, this);
      }
    }, this);
  };
}

/** The full document as a single update — what compaction writes. */
export const encodeDoc = (doc: Doc): Uint8Array => encodeStateAsUpdate(doc);
