/**
 * DEV-707 — the spike's primary gate.
 *
 * Silent divergence is this design's real failure mode. Two browsers side by
 * side cannot show it: both windows look plausible, and the documents differ in
 * a way nothing surfaces until someone reloads and loses a paragraph. So every
 * scenario below ends in a machine assertion that the participating documents
 * hold *identical* Yjs state, not merely similar text.
 *
 * "Identical" means two things, and both are checked:
 *
 * - **Equal state vectors.** A state vector is the per-client clock of every
 *   update a document has seen. Equal vectors mean neither document is missing
 *   an update the other has — the property that actually matters.
 * - **Equal rendered text.** Guards against the degenerate case where both
 *   documents are equally wrong, and makes a failure legible.
 *
 * Text equality alone would be far too weak: two documents can render the same
 * string from different update sets and diverge on the next edit.
 *
 * Running these needs a live Realtime server, which CI does not have, so the
 * suite skips when no local stack is listening. A skip that scrolls past
 * unnoticed reads as a pass, so it announces itself loudly.
 */

import { Doc, Text, encodeStateVector } from 'yjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

import { compactPassageDoc } from './compaction';
import { PassageSyncProvider } from './provider';
import { SupabaseSyncTransport } from './supabase-transport';
import { LOCAL_STACK_ENV } from './testing/global-setup';
import {
  countLogRows,
  createEditorClient,
  createServiceClient,
  createTestPassage,
  dropTestPassage,
  logByteSize,
  pickSeedWork,
} from './testing/local-stack';

jest.setTimeout(120_000);

/**
 * Direct Postgres, used by exactly one test. PostgREST gives every request its
 * own transaction, so the seq-gap interleaving — one session holding a low seq
 * uncommitted while another commits a higher one — is not expressible through
 * the Supabase client at all.
 */
const LOCAL_DB_URL =
  process.env.LOCAL_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const FLUSH_MS = 300;

/** Generous relative to a measured ~10ms round trip; absorbs CI jitter. */
const SETTLE_MS = 2_500;

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const body = (doc: Doc): Text => doc.getText('body');

/**
 * The assertion every scenario ends with.
 *
 * Compares each document against the first rather than pairwise: equality is
 * transitive, and a pairwise matrix would report the same divergence n times.
 */
const expectConverged = (docs: { name: string; doc: Doc }[]): void => {
  const [reference, ...rest] = docs;
  const referenceVector = hex(encodeStateVector(reference.doc));
  const referenceText = body(reference.doc).toString();

  for (const other of rest) {
    expect({
      client: other.name,
      stateVector: hex(encodeStateVector(other.doc)),
      text: body(other.doc).toString(),
    }).toEqual({
      client: other.name,
      stateVector: referenceVector,
      text: referenceText,
    });
  }
};

type Peer = {
  name: string;
  doc: Doc;
  client: SupabaseClient;
  transport: SupabaseSyncTransport;
  provider: PassageSyncProvider;
  latencies: number[];
  errors: unknown[];
};

/**
 * Resolved by `globalSetup` before any `describe` body runs, so the suite can
 * be skipped outright rather than passing vacuously. `localStackAvailable` is
 * still imported and used there — this is just the synchronous view of it.
 */
const available = process.env[LOCAL_STACK_ENV] === '1';

if (!available) {
  console.warn(
    [
      '',
      '='.repeat(72),
      'DEV-707 convergence suite SKIPPED — no local Supabase stack.',
      "These tests are the spike's primary gate; a skip is NOT a pass.",
      'Start the stack with `make start` in the infra repo and re-run.',
      '='.repeat(72),
      '',
    ].join('\n'),
  );
}

const describeIfLocalStack = available ? describe : describe.skip;

describeIfLocalStack('Yjs sync over Supabase Realtime (DEV-707)', () => {
  let service: SupabaseClient;
  let workUuid: string;

  beforeAll(async () => {
    service = createServiceClient();
    workUuid = await pickSeedWork(service);
  });

  /** A fresh passage per test — see `createTestPassage` for why sharing lies. */
  const withPassage = async (
    run: (passageUuid: string) => Promise<void>,
  ): Promise<void> => {
    const passageUuid = await createTestPassage(service, workUuid);
    try {
      await run(passageUuid);
    } finally {
      await dropTestPassage(service, passageUuid);
    }
  };

  const connectPeer = async (
    name: string,
    passageUuid: string,
    options: { mode?: 'trigger' | 'direct' } = {},
  ): Promise<Peer> => {
    const doc = new Doc();
    const client = createEditorClient();
    const transport = new SupabaseSyncTransport(client);
    const latencies: number[] = [];
    const errors: unknown[] = [];

    const provider = new PassageSyncProvider({
      doc,
      workUuid,
      passageUuid,
      transport,
      flushMs: FLUSH_MS,
      mode: options.mode ?? 'trigger',
      onLatencySample: (sample) => latencies.push(sample.roundTripMs),
      onError: (error) => errors.push(error),
    });

    await provider.connect();
    return { name, doc, client, transport, provider, latencies, errors };
  };

  const teardown = async (peers: Peer[]): Promise<void> => {
    for (const peer of peers) {
      await peer.provider.destroy();
      await peer.client.removeAllChannels();
    }
  };

  /** Flush everyone, then let the relay settle. */
  const settle = async (peers: Peer[]): Promise<void> => {
    await Promise.all(peers.map((peer) => peer.provider.flush()));
    await sleep(SETTLE_MS);
  };

  const expectNoErrors = (peers: Peer[]): void => {
    for (const peer of peers) {
      expect({ client: peer.name, errors: peer.errors }).toEqual({
        client: peer.name,
        errors: [],
      });
    }
  };

  describe('live co-editing', () => {
    it('converges two clients editing the same passage concurrently', async () => {
      await withPassage(async (passageUuid) => {
        const a = await connectPeer('A', passageUuid);
        const b = await connectPeer('B', passageUuid);

        // Both edit before either has seen the other — the collision case.
        body(a.doc).insert(0, 'The Buddha was dwelling ');
        body(b.doc).insert(0, 'at Rajagriha. ');

        await settle([a, b]);

        expectNoErrors([a, b]);
        expectConverged([a, b]);
        expect(body(a.doc).toString()).toContain('The Buddha was dwelling');
        expect(body(a.doc).toString()).toContain('at Rajagriha.');

        await teardown([a, b]);
      });
    });

    it('converges four clients typing interleaved', async () => {
      await withPassage(async (passageUuid) => {
        const peers = [
          await connectPeer('A', passageUuid),
          await connectPeer('B', passageUuid),
          await connectPeer('C', passageUuid),
          await connectPeer('D', passageUuid),
        ];

        // The issue's stated ceiling: four concurrent editors, all typing.
        for (let round = 0; round < 8; round += 1) {
          for (const peer of peers) {
            body(peer.doc).insert(0, `${peer.name}${round} `);
          }
          await sleep(FLUSH_MS + 50);
        }

        await settle(peers);

        expectNoErrors(peers);
        expectConverged(peers);
        // Nothing was lost: every client's every round is present exactly once.
        const text = body(peers[0].doc).toString();
        for (const peer of peers) {
          for (let round = 0; round < 8; round += 1) {
            expect(text.split(`${peer.name}${round} `).length - 1).toBe(1);
          }
        }

        await teardown(peers);
      });
    });
  });

  describe('kill and reconnect', () => {
    it('converges a client that was offline through a burst of concurrent edits', async () => {
      await withPassage(async (passageUuid) => {
        const a = await connectPeer('A', passageUuid);
        const b = await connectPeer('B', passageUuid);
        const offline = await connectPeer('Offline', passageUuid);

        body(a.doc).insert(0, 'before. ');
        await settle([a, b, offline]);
        expectConverged([a, b, offline]);

        // Drop the channel without flushing — a closed laptop, not a clean exit.
        await offline.provider.disconnect();

        // Peers keep working while it is away.
        body(a.doc).insert(0, 'during-A. ');
        body(b.doc).insert(0, 'during-B. ');
        await settle([a, b]);

        // And it keeps editing locally, which is the whole point of the CRDT.
        body(offline.doc).insert(0, 'during-offline. ');

        await offline.provider.connect();
        await settle([a, b, offline]);

        expectNoErrors([a, b, offline]);
        expectConverged([a, b, offline]);

        const text = body(a.doc).toString();
        expect(text).toContain('before.');
        expect(text).toContain('during-A.');
        expect(text).toContain('during-B.');
        // The offline client's own work reached the others, not just vice versa.
        expect(text).toContain('during-offline.');

        await teardown([a, b, offline]);
      });
    });

    it('converges a client that joins long after the edits happened', async () => {
      await withPassage(async (passageUuid) => {
        const a = await connectPeer('A', passageUuid);
        const b = await connectPeer('B', passageUuid);

        for (let i = 0; i < 5; i += 1) {
          body(a.doc).insert(0, `a${i} `);
          body(b.doc).insert(0, `b${i} `);
          await sleep(FLUSH_MS + 50);
        }
        await settle([a, b]);

        // Pure catch-up: this client was not present for any of it.
        const late = await connectPeer('Late', passageUuid);
        await settle([a, b, late]);

        expectNoErrors([a, b, late]);
        expectConverged([a, b, late]);

        await teardown([a, b, late]);
      });
    });
  });

  describe('compaction', () => {
    it('does not break a live session, and a client joining after it converges', async () => {
      await withPassage(async (passageUuid) => {
        const a = await connectPeer('A', passageUuid);
        const b = await connectPeer('B', passageUuid);

        for (let i = 0; i < 6; i += 1) {
          body(a.doc).insert(0, `pre${i} `);
          await sleep(FLUSH_MS + 50);
        }
        await settle([a, b]);

        const before = await countLogRows(service, passageUuid);
        expect(before).toBeGreaterThan(0);

        // Compact while both sessions are live and subscribed.
        const serviceTransport = new SupabaseSyncTransport(service);
        const result = await compactPassageDoc({
          passageUuid,
          workUuid,
          fetchState: (uuid) => serviceTransport.fetchState(uuid),
          commit: (input) => serviceTransport.compact(input),
        });

        expect(result).not.toBeNull();
        expect(result?.rowsDeleted).toBe(before);
        expect(await countLogRows(service, passageUuid)).toBe(0);

        // The live session keeps working across compaction.
        body(a.doc).insert(0, 'post-compaction-A ');
        body(b.doc).insert(0, 'post-compaction-B ');
        await settle([a, b]);

        expectNoErrors([a, b]);
        expectConverged([a, b]);

        // And a client that only ever sees the snapshot plus the tail agrees.
        const late = await connectPeer('Late', passageUuid);
        await settle([a, b, late]);
        expectConverged([a, b, late]);

        const text = body(late.doc).toString();
        expect(text).toContain('pre0');
        expect(text).toContain('post-compaction-A');
        expect(text).toContain('post-compaction-B');

        await teardown([a, b, late]);
      });
    });

    it('refuses to move a snapshot backwards', async () => {
      await withPassage(async (passageUuid) => {
        const a = await connectPeer('A', passageUuid);
        body(a.doc).insert(0, 'one ');
        await settle([a]);

        const serviceTransport = new SupabaseSyncTransport(service);
        const first = await compactPassageDoc({
          passageUuid,
          workUuid,
          fetchState: (uuid) => serviceTransport.fetchState(uuid),
          commit: (input) => serviceTransport.compact(input),
        });
        expect(first).not.toBeNull();

        // A concurrent run that read an older watermark must be a no-op, not a
        // rollback that deletes rows absent from the surviving snapshot.
        const stale = await serviceTransport.compact({
          passageUuid,
          workUuid,
          doc: new Uint8Array([0]),
          stateVector: new Uint8Array([0]),
          seqThrough: (first?.seqThrough ?? 1) - 1,
        });
        expect(stale).toBe(0);

        const late = await connectPeer('Late', passageUuid);
        await settle([a, late]);
        expectConverged([a, late]);
        expect(body(late.doc).toString()).toContain('one');

        await teardown([a, late]);
      });
    });
  });

  describe('the seq gap hazard', () => {
    /**
     * Why catch-up must not resume from a seq watermark.
     *
     * Identity values are handed out before commit, so an in-flight transaction
     * can hold a *lower* seq than one that has already committed and been read.
     * A client resuming from "everything through max(seq) I saw" skips the
     * straggler permanently — no error, no retry, a missing edit.
     *
     * This constructs that interleaving explicitly and shows both halves: the
     * naive watermark loses the row, and the shipped snapshot-anchored path
     * does not. Without this, a future optimisation to "just resume from seq"
     * would look correct and cost a paragraph.
     */
    it('loses a straggler under a naive seq watermark, and does not under catch-up', async () => {
      await withPassage(async (passageUuid) => {
        const slow = new PgClient({ connectionString: LOCAL_DB_URL });
        const fast = new PgClient({ connectionString: LOCAL_DB_URL });
        await slow.connect();
        await fast.connect();

        const insert = (client: PgClient, tag: string) =>
          client.query(
            `insert into public.passage_doc_updates
               (work_uuid, passage_uuid, client_id, "update")
             values ($1, $2, $3, $4) returning seq`,
            [workUuid, passageUuid, tag, Buffer.from(tag)],
          );

        try {
          // `slow` allocates the LOWER seq first, but does not commit.
          await slow.query('begin');
          const stragglerSeq = (await insert(slow, 'straggler')).rows[0].seq;

          // `fast` allocates a HIGHER seq and commits immediately, so a reader
          // now sees the higher seq while the lower one is still invisible.
          const laterSeq = (await insert(fast, 'later')).rows[0].seq;
          expect(Number(laterSeq)).toBeGreaterThan(Number(stragglerSeq));

          // A client reads the log here and records "I have everything through
          // max(seq)" — which is `laterSeq`, skipping past the uncommitted row.
          const visible = await service
            .from('passage_doc_updates')
            .select('seq')
            .eq('passage_uuid', passageUuid)
            .order('seq', { ascending: false });
          const watermark = Number(visible.data?.[0]?.seq);
          expect(watermark).toBe(Number(laterSeq));
          expect(visible.data?.length).toBe(1);

          // Now the straggler commits, out of seq order.
          await slow.query('commit');

          // The naive resume asks for `seq > watermark` and gets nothing. The
          // straggler is below the watermark and is now invisible forever.
          const naive = await service
            .from('passage_doc_updates')
            .select('seq, client_id')
            .eq('passage_uuid', passageUuid)
            .gt('seq', watermark);
          expect(naive.data ?? []).toEqual([]);

          // The shipped path is anchored on the snapshot, not on a seq the
          // client happened to observe, so it still returns both rows.
          const anchored = await new SupabaseSyncTransport(
            service,
          ).fetchState(passageUuid);
          expect(anchored.updates.length).toBe(2);
          expect(anchored.updates.map((row) => row.clientId).sort()).toEqual([
            'later',
            'straggler',
          ]);
        } finally {
          await slow.query('rollback').catch(() => undefined);
          await slow.end();
          await fast.end();
        }
      });
    });
  });

  describe('RLS', () => {
    it('denies a client without editor.edit', async () => {
      await withPassage(async (passageUuid) => {
        // `viewer` has no editor.edit binding in role_permissions, so
        // public.authorize returns false for it.
        const viewer = createEditorClient({ user_role: 'viewer' });

        const read = await viewer
          .from('passage_doc_updates')
          .select('seq')
          .eq('passage_uuid', passageUuid);
        expect(read.data ?? []).toEqual([]);

        const write = await viewer.from('passage_doc_updates').insert({
          work_uuid: workUuid,
          passage_uuid: passageUuid,
          client_id: 'viewer',
          update: '\\x0102',
        });
        expect(write.error).not.toBeNull();

        await viewer.removeAllChannels();
      });
    });

    it('admits a client with editor.edit', async () => {
      await withPassage(async (passageUuid) => {
        const editor = createEditorClient();
        const write = await editor.from('passage_doc_updates').insert({
          work_uuid: workUuid,
          passage_uuid: passageUuid,
          client_id: 'editor',
          update: '\\x0102',
        });
        expect(write.error).toBeNull();

        const read = await editor
          .from('passage_doc_updates')
          .select('seq')
          .eq('passage_uuid', passageUuid);
        expect((read.data ?? []).length).toBe(1);

        await editor.removeAllChannels();
      });
    });
  });

  describe('measurements (recorded, not gated)', () => {
    it('records round-trip latency on the trigger and direct paths', async () => {
      await withPassage(async (passageUuid) => {
        const report: Record<string, unknown> = {};

        for (const mode of ['trigger', 'direct'] as const) {
          const a = await connectPeer(`A-${mode}`, passageUuid, { mode });
          const b = await connectPeer(`B-${mode}`, passageUuid, { mode });

          for (let i = 0; i < 10; i += 1) {
            body(a.doc).insert(0, `${mode}${i} `);
            await sleep(FLUSH_MS + 100);
          }
          await settle([a, b]);

          const samples = [...a.latencies].sort((x, y) => x - y);
          report[mode] = {
            samples: samples.length,
            medianMs: samples[Math.floor(samples.length / 2)],
            maxMs: samples[samples.length - 1],
          };

          expectConverged([a, b]);
          await teardown([a, b]);
        }

        console.log('DEV-707 round-trip latency:', JSON.stringify(report));
        expect(report.trigger).toBeDefined();
      });
    });

    it('records write amplification for a minute of active typing', async () => {
      await withPassage(async (passageUuid) => {
        const a = await connectPeer('A', passageUuid);

        // ~200 keystrokes over 20s: a fast typist's rate, scaled down so the
        // test stays short. Reported per-minute below.
        const seconds = 20;
        const perSecond = 10;
        for (let s = 0; s < seconds; s += 1) {
          for (let k = 0; k < perSecond; k += 1) {
            body(a.doc).insert(body(a.doc).length, 'x');
          }
          await sleep(1000);
        }
        await settle([a]);

        const rows = await countLogRows(service, passageUuid);
        const bytes = await logByteSize(service, passageUuid);
        const keystrokes = seconds * perSecond;
        const scale = 60 / seconds;

        console.log(
          'DEV-707 write amplification:',
          JSON.stringify({
            keystrokes,
            rows,
            storedBytes: bytes,
            perMinute: {
              rows: Math.round(rows * scale),
              storedBytes: Math.round(bytes * scale),
              // The relay pays base64 on top; the log does not.
              broadcastBytes: Math.round(bytes * scale * (4 / 3)),
            },
            flushMs: FLUSH_MS,
          }),
        );

        // One row per flush window, not one per keystroke — the property the
        // coalescing exists to produce.
        expect(rows).toBeLessThan(keystrokes);
        await teardown([a]);
      });
    });
  });
});
