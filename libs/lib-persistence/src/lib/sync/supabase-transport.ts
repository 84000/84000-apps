import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { toBase64 } from './encoding';
import type { EditorPresence, PresenceConfig } from './presence';
import type {
  EncodedUpdate,
  PassageDocState,
  SyncSubscription,
  SyncTransport,
} from './types';

/** Realtime topic for a passage. Must match the trigger in the migration. */
export const passageTopic = (passageUuid: string): string =>
  `passage:${passageUuid}`;

export const DOC_UPDATE_EVENT = 'doc-update';

/**
 * PostgREST takes `bytea` as the Postgres hex literal. Handing it base64 stores
 * the *characters* of the base64 instead, silently — a corrupt log that reads
 * back as well-formed bytes and only fails later when Yjs tries to decode it.
 */
const toPostgresHex = (bytes: Uint8Array): string =>
  `\\x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;

type RawUpdate = {
  seq: number | null;
  client_id: string;
  update: string;
};

type RawState = {
  snapshot: {
    doc: string;
    state_vector: string;
    seq_through: number;
  } | null;
  updates: RawUpdate[];
};

const decodeRows = (rows: RawUpdate[]): EncodedUpdate[] =>
  rows.map((row) => ({
    seq: row.seq ?? null,
    clientId: row.client_id,
    update: row.update,
  }));

/**
 * Supabase implementation of `SyncTransport`.
 *
 * Channels are **private**, so joining is authorized by the RLS policies on
 * `realtime.messages` rather than being open to anyone holding the anon key.
 * The migration adds those policies; without them a client silently receives
 * nothing, which looks exactly like a quiet relay.
 */
export class SupabaseSyncTransport implements SyncTransport {
  private readonly client: SupabaseClient;
  private readonly channels = new Map<string, RealtimeChannel>();

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchState(passageUuid: string): Promise<PassageDocState> {
    const { data, error } = await this.client.rpc('get_passage_doc_state', {
      p_passage_uuid: passageUuid,
    });

    if (error) {
      throw new Error(`get_passage_doc_state failed: ${error.message}`);
    }

    const raw = data as RawState;
    return {
      snapshot: raw.snapshot
        ? {
            doc: raw.snapshot.doc,
            stateVector: raw.snapshot.state_vector,
            seqThrough: raw.snapshot.seq_through,
          }
        : null,
      updates: decodeRows(raw.updates ?? []),
    };
  }

  async append(params: {
    workUuid: string;
    passageUuid: string;
    clientId: string;
    update: Uint8Array;
  }): Promise<void> {
    const { error } = await this.client.from('passage_doc_updates').insert({
      work_uuid: params.workUuid,
      passage_uuid: params.passageUuid,
      client_id: params.clientId,
      update: toPostgresHex(params.update),
    });

    if (error) {
      throw new Error(`passage_doc_updates insert failed: ${error.message}`);
    }
  }

  async subscribe(params: {
    passageUuid: string;
    onUpdates: (updates: EncodedUpdate[]) => void;
    presence?: PresenceConfig;
  }): Promise<SyncSubscription> {
    // Push the caller's token onto the Realtime socket *before* joining.
    //
    // Without this the join races the client's own auth plumbing: the socket
    // opens with the publishable key alone, Postgres sees role `anon`, and the
    // policies on `realtime.messages` — which grant to `authenticated` — do not
    // apply. The join is then rejected as "You do not have permissions to read
    // from this Channel topic", which reads like a broken policy and is not.
    //
    // It is a race, so it hides: a client that connects slowly enough wins and
    // works, and the same code under load fails. Cost us an hour on this spike.
    await this.client.realtime.setAuth();

    const topic = passageTopic(params.passageUuid);
    const presence = params.presence;
    const channel = this.client.channel(topic, {
      config: {
        private: true,
        ...(presence ? { presence: { key: presence.self.clientId } } : {}),
      },
    });

    channel.on(
      'broadcast',
      { event: DOC_UPDATE_EVENT },
      (message: { payload?: { updates?: RawUpdate[] } }) => {
        const rows = message.payload?.updates;
        if (rows?.length) params.onUpdates(decodeRows(rows));
      },
    );

    // Every callback must be registered before `subscribe()` — the client
    // rejects additions afterwards, and there is only ever one channel object
    // per topic to add them to.
    if (presence) {
      const emit = () => {
        const state = channel.presenceState<EditorPresence>();
        presence.onChange(
          Object.values(state)
            .flat()
            .filter((peer) => peer.clientId !== presence.self.clientId),
        );
      };
      channel.on('presence', { event: 'sync' }, emit);
      channel.on('presence', { event: 'join' }, emit);
      channel.on('presence', { event: 'leave' }, emit);
    }

    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status: string, error?: Error) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          reject(
            new Error(
              `channel ${topic} failed: ${status}${
                error ? ` (${error.message})` : ''
              }`,
            ),
          );
        }
      });
    });

    this.channels.set(topic, channel);

    if (presence) {
      await channel.track({ ...presence.self, cursor: null });
    }

    return {
      unsubscribe: async () => {
        this.channels.delete(topic);
        if (presence) await channel.untrack();
        await this.client.removeChannel(channel);
      },
      setCursor: presence
        ? async (cursor: string | null) => {
            await channel.track({ ...presence.self, cursor });
          }
        : undefined,
    };
  }

  /** Commit half of compaction. Returns the number of log rows collected. */
  async compact(params: {
    passageUuid: string;
    workUuid: string;
    doc: Uint8Array;
    stateVector: Uint8Array;
    seqThrough: number;
  }): Promise<number> {
    const { data, error } = await this.client.rpc('compact_passage_doc', {
      p_passage_uuid: params.passageUuid,
      p_work_uuid: params.workUuid,
      p_doc: toPostgresHex(params.doc),
      p_state_vector: toPostgresHex(params.stateVector),
      p_seq_through: params.seqThrough,
    });

    if (error) throw new Error(`compact_passage_doc failed: ${error.message}`);
    return data as number;
  }

  /** Passages whose uncompacted log has grown past `minUpdates` rows. */
  async passagesNeedingCompaction(
    minUpdates = 50,
  ): Promise<{ passageUuid: string; workUuid: string; count: number }[]> {
    const { data, error } = await this.client.rpc(
      'passages_needing_compaction',
      { p_min_updates: minUpdates },
    );

    if (error) {
      throw new Error(`passages_needing_compaction failed: ${error.message}`);
    }

    return (
      data as { passage_uuid: string; work_uuid: string; update_count: number }[]
    ).map((row) => ({
      passageUuid: row.passage_uuid,
      workUuid: row.work_uuid,
      count: Number(row.update_count),
    }));
  }

  /**
   * Client-side broadcast, for the `direct` measurement path only.
   *
   * Reuses the joined channel so the comparison is the trigger hop and nothing
   * else. Payload shape matches the trigger's so the receiver cannot tell the
   * paths apart; `seq` is null because no row assigned one.
   */
  async broadcast(params: {
    passageUuid: string;
    clientId: string;
    update: Uint8Array;
  }): Promise<void> {
    const topic = passageTopic(params.passageUuid);
    const channel = this.channels.get(topic);
    if (!channel) throw new Error(`not subscribed to ${topic}`);

    await channel.send({
      type: 'broadcast',
      event: DOC_UPDATE_EVENT,
      payload: {
        updates: [
          {
            seq: null,
            client_id: params.clientId,
            update: toBase64(params.update),
          },
        ],
      },
    });
  }
}
