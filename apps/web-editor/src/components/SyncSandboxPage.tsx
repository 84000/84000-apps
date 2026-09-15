'use client';

/**
 * DEV-707 sync sandbox.
 *
 * Two browser windows on this page co-edit one passage through the real path:
 * insert into `passage_doc_updates`, Postgres trigger, Supabase Realtime,
 * apply. Open it twice and type in both.
 *
 * The **state fingerprint** is the part to actually watch. It is a short hash of
 * the document's Yjs state vector, so two windows showing the same fingerprint
 * hold provably identical state and two showing different fingerprints have
 * diverged — which the text alone will not tell you, because divergent
 * documents usually still look plausible. It is the human-readable form of the
 * assertion in `convergence.spec.ts`, and it is there because eyeballing two
 * editors is precisely the test that cannot catch this design's real failure.
 *
 * Deliberately a plain textarea rather than the Tiptap editor: the thing under
 * test is the sync substrate, and a rich-text binding would put y-prosemirror
 * between the keystroke and the assertion.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Doc, Text, encodeStateVector } from 'yjs';
import {
  PassageSyncProvider,
  SupabaseSyncTransport,
  type EditorPresence,
  type PassageSyncStatus,
} from '@eightyfourthousand/lib-persistence';

type Session = {
  supabaseUrl: string;
  anonKey: string;
  token: string;
  workUuid: string;
  passageUuid: string;
};

/** Short, stable digest of the state vector — the convergence tell. */
const fingerprint = (doc: Doc): string => {
  const bytes = encodeStateVector(doc);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

/**
 * Apply a textarea's new value to a Y.Text as a minimal splice.
 *
 * Replacing the whole text on every keystroke would delete and reinsert every
 * character, which converges but destroys the other editor's cursor and makes
 * the update log meaningless as a measurement. Trimming to the changed middle
 * is what a real binding does.
 */
const spliceText = (target: Text, next: string): void => {
  const current = target.toString();
  if (current === next) return;

  let start = 0;
  const max = Math.min(current.length, next.length);
  while (start < max && current[start] === next[start]) start += 1;

  let fromEnd = 0;
  while (
    fromEnd < max - start &&
    current[current.length - 1 - fromEnd] === next[next.length - 1 - fromEnd]
  ) {
    fromEnd += 1;
  }

  const removed = current.length - start - fromEnd;
  const inserted = next.slice(start, next.length - fromEnd);

  target.doc?.transact(() => {
    if (removed > 0) target.delete(start, removed);
    if (inserted.length > 0) target.insert(start, inserted);
  });
};

export function SyncSandboxPage() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PassageSyncStatus>('idle');
  const [text, setText] = useState('');
  const [stamp, setStamp] = useState('—');
  const [rows, setRows] = useState(0);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [peers, setPeers] = useState<EditorPresence[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState('—');

  const docRef = useRef<Doc | null>(null);
  const providerRef = useRef<PassageSyncProvider | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    let provider: PassageSyncProvider | null = null;

    const boot = async () => {
      const response = await fetch('/sync/session');
      const payload = await response.json();
      if (!response.ok) {
        if (!cancelled) setError(payload.error ?? 'Could not start a session');
        return;
      }
      if (cancelled) return;

      const config = payload as Session;
      setSession(config);

      const client = createClient(config.supabaseUrl, config.anonKey, {
        accessToken: async () => config.token,
        auth: { persistSession: false, autoRefreshToken: false },
      });
      clientRef.current = client;

      const doc = new Doc();
      docRef.current = doc;

      // Presence rides the document channel, so it is configured up front
      // rather than joined afterwards — see `presence.ts`.
      const selfId =
        globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);

      provider = new PassageSyncProvider({
        doc,
        workUuid: config.workUuid,
        passageUuid: config.passageUuid,
        transport: new SupabaseSyncTransport(client),
        clientId: selfId,
        flushMs: 300,
        presence: {
          self: {
            clientId: selfId,
            userId: 'local-editor',
            displayName: `tab-${selfId.slice(0, 6)}`,
          },
          onChange: (next) => !cancelled && setPeers(next),
        },
        onStatusChange: (next) => !cancelled && setStatus(next),
        onLatencySample: (sample) =>
          !cancelled &&
          setLatencies((prior) => [...prior.slice(-19), sample.roundTripMs]),
        onError: (cause) => !cancelled && setError(String(cause)),
      });
      providerRef.current = provider;
      setClientId(provider.clientId.slice(0, 6));

      const refresh = () => {
        if (cancelled) return;
        setText(doc.getText('body').toString());
        setStamp(fingerprint(doc));
      };
      doc.on('update', refresh);

      try {
        await provider.connect();
        refresh();
        setConnected(true);
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      }
    };

    void boot();

    return () => {
      cancelled = true;
      void provider?.destroy();
    };
  }, []);

  // Log depth, polled — shows compaction taking effect while a session is live.
  useEffect(() => {
    if (!session || !clientRef.current) return;
    const client = clientRef.current;
    const tick = async () => {
      const { count } = await client
        .from('passage_doc_updates')
        .select('seq', { count: 'exact', head: true })
        .eq('passage_uuid', session.passageUuid);
      setRows(count ?? 0);
    };
    void tick();
    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, [session]);

  const onChange = useCallback((value: string) => {
    setText(value);
    const doc = docRef.current;
    if (doc) spliceText(doc.getText('body'), value);
  }, []);

  const median =
    latencies.length === 0
      ? null
      : [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)];

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold">DEV-707 sync sandbox</h1>
        <pre className="mt-4 whitespace-pre-wrap rounded bg-red-50 p-4 text-sm text-red-900">
          {error}
        </pre>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header>
        <h1 className="text-xl font-semibold">DEV-707 sync sandbox</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Open this page in a second window and type in both. The fingerprints
          must match once typing stops — that is the convergence check. The text
          matching is not sufficient evidence on its own.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded border border-neutral-200 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-mono">{status}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">State fingerprint</dt>
          <dd className="font-mono text-base font-semibold">{stamp}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Round trip (median)</dt>
          <dd className="font-mono">{median === null ? '—' : `${median} ms`}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Uncompacted log rows</dt>
          <dd className="font-mono">{rows}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Other editors here</dt>
          <dd className="font-mono">
            {peers.length === 0
              ? 'none'
              : peers.map((peer) => peer.displayName).join(', ')}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">This client</dt>
          <dd className="font-mono">
            {clientId}
          </dd>
        </div>
      </dl>

      <textarea
        className="h-72 w-full rounded border border-neutral-300 p-3 font-mono text-sm"
        value={text}
        disabled={!connected}
        onChange={(event) => onChange(event.target.value)}
        placeholder={connected ? 'Type here…' : 'Connecting…'}
      />

      <p className="text-xs text-neutral-500">
        Passage <code>{session?.passageUuid ?? '—'}</code>. Compact the log with{' '}
        <code>
          curl -X POST
          &quot;$SUPABASE_URL/functions/v1/compact-passage-docs?passage=
          {session?.passageUuid ?? '<uuid>'}&quot; -H &quot;Authorization:
          Bearer $SERVICE_ROLE_KEY&quot;
        </code>{' '}
        and watch the row count drop without the session breaking.
      </p>
    </main>
  );
}
