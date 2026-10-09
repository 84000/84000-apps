/**
 * The seam between the sync provider and whatever moves its bytes.
 *
 * Same reasoning as `driver.ts` for storage: the provider owns the Yjs
 * behaviour — coalescing, echo suppression, catch-up ordering — and knows
 * nothing about Supabase. `SupabaseSyncTransport` is the only file in this
 * package that imports `@supabase/supabase-js`, and the convergence tests can
 * drive the provider through an in-memory transport when they need determinism
 * rather than a real server.
 *
 * Keep this interface small. If it grows, the provider has started to depend on
 * Supabase specifics and the seam has stopped paying for itself.
 */

import type { PresenceConfig } from './presence';

/** A Yjs update as it travels: base64, because `realtime.send` takes jsonb. */
export type EncodedUpdate = {
  /** Server-assigned ordering key. Absent on a direct client broadcast. */
  seq: number | null;
  /** Originating provider instance, so a client can drop its own echo. */
  clientId: string;
  /** Base64 of a Yjs v1 update. */
  update: string;
};

/** What `get_passage_doc_state` returns: a snapshot plus the rows it misses. */
export type PassageDocState = {
  snapshot: {
    doc: string;
    stateVector: string;
    seqThrough: number;
  } | null;
  updates: EncodedUpdate[];
};

export type SyncSubscription = {
  unsubscribe: () => Promise<void>;
  /** Present only when the subscription was opened with presence configured. */
  setCursor?: (cursor: string | null) => Promise<void>;
};

/**
 * How an update reaches other clients.
 *
 * - `trigger` — the primary path. The client only inserts; a Postgres trigger
 *   relays the row to Realtime. One write, one ordering, and nothing can be
 *   broadcast that was not also stored.
 * - `direct` — the client inserts *and* broadcasts on the channel itself, to
 *   measure how much latency the trigger hop costs. Not a production candidate:
 *   a broadcast that lands while its insert fails is an edit peers render and
 *   nobody has.
 */
export type SyncMode = 'trigger' | 'direct';

export interface SyncTransport {
  /** Snapshot plus every uncovered log row, read in one transaction. */
  fetchState(passageUuid: string): Promise<PassageDocState>;

  /** Append a coalesced update to the durable log. */
  append(params: {
    workUuid: string;
    passageUuid: string;
    clientId: string;
    update: Uint8Array;
  }): Promise<void>;

  /**
   * Join the passage channel. Must be awaited to completion before any
   * `fetchState` the caller intends to treat as catch-up — see the ordering
   * note in `provider.ts`.
   *
   * Presence is configured here rather than joined separately because one topic
   * means one channel object, and its callbacks must all be registered before
   * it subscribes. See `presence.ts`.
   */
  subscribe(params: {
    passageUuid: string;
    onUpdates: (updates: EncodedUpdate[]) => void;
    presence?: PresenceConfig;
  }): Promise<SyncSubscription>;

  /** Client-side broadcast, for the `direct` comparison path only. */
  broadcast?(params: {
    passageUuid: string;
    clientId: string;
    update: Uint8Array;
  }): Promise<void>;
}
