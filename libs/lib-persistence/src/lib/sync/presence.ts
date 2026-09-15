/**
 * Who's-here and cursors, carried on the passage's document channel.
 *
 * Presence rides the *same* channel as the document updates rather than opening
 * its own. That is partly a quota decision — a Realtime channel is the unit of
 * both connection and message budget, and a second channel per passage would
 * double both for information strictly less important than the edits — but it
 * is also forced: `supabase.channel(topic)` returns the *existing* channel for a
 * topic that is already joined, and callbacks cannot be registered after
 * `subscribe()`. A separate `joinPassagePresence` that made its own channel
 * therefore threw `cannot add 'presence' callbacks ... after subscribe()` the
 * first time it ran against a live provider. Presence has to be configured
 * before the document channel joins, so it is part of `subscribe`.
 *
 * Presence state is ephemeral and server-held: dropped when the socket closes,
 * with no cleanup and no tombstone row. That is the right shape for "who is
 * looking at this", and it is why cursors are not in `passage_doc_updates` — a
 * cursor has no value after the session that produced it, and writing one per
 * keystroke to a durable log would swamp the actual edits.
 *
 * Deliberately not Yjs awareness. Awareness is its own protocol over its own
 * connection; Realtime presence keeps one channel, one auth path and one set of
 * quota semantics. The cost is that y-prosemirror's cursor plugin cannot be
 * dropped in unmodified — it expects an awareness instance. That is a Phase 1
 * decision, not a spike one.
 */

export type EditorPresence = {
  clientId: string;
  userId: string;
  displayName: string;
  /** Cursor as a Yjs relative position, base64. Null when not in the passage. */
  cursor: string | null;
};

export type PresenceConfig = {
  self: Omit<EditorPresence, 'cursor'>;
  onChange: (peers: EditorPresence[]) => void;
};

export type PresenceHandle = {
  setCursor: (cursor: string | null) => Promise<void>;
};
