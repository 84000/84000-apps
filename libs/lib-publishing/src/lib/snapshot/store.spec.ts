import type { DataClient } from '@eightyfourthousand/data-access';
import type { WorkSnapshot } from './generate';
import { SNAPSHOT_FORMAT_VERSION, type SnapshotManifest } from './render';
import {
  getWorkSnapshot,
  prune,
  regenerate,
  sameDraftKey,
  signSnapshot,
  SNAPSHOT_STORE_SETTINGS,
  type WorkSnapshotRow,
} from './store';

const WORK = '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d';
const S = SNAPSHOT_STORE_SETTINGS;
const MIN = 60_000;

/**
 * An in-memory stand-in for the service-role client: the four tables the store reads,
 * the three RPCs (mirroring their SQL), and the bucket. `clock.t` drives both the
 * store's `now` and the "database" clock.
 */
const fakeBackend = () => {
  const clock = { t: Date.parse('2026-10-13T10:00:00Z') };
  const iso = (t = clock.t) => new Date(t).toISOString();
  let leases = 0;
  const state = {
    works: new Map([[WORK, { uuid: WORK, toh: 'toh1', title: 'T' }]]),
    liveKey: '2026-10-13T09:00:00.000001+00:00' as string | null,
    row: null as WorkSnapshotRow | null,
    objects: new Map<string, { created_at: string }>(),
    failUpload: false,
    failRemove: false,
    /** 'error-committed' applies the update and still reports an error. */
    completeMode: 'ok' as 'ok' | 'error-committed' | 'error-not-committed',
    signed: [] as string[],
  };

  const single = (table: string, value: unknown) => {
    switch (table) {
      case 'work_toh':
        return value === 'toh1' && state.works.has(WORK)
          ? { work_uuid: WORK }
          : null;
      case 'works':
        return state.works.get(value as string) ?? null;
      case 'work_publish_status':
        return state.works.has(value as string)
          ? { draft_touched_at: state.liveKey }
          : null;
      case 'work_snapshots':
        return state.row && state.row.work_uuid === value
          ? (JSON.parse(JSON.stringify(state.row)) as WorkSnapshotRow)
          : null;
      default:
        throw new Error(`unexpected table ${table}`);
    }
  };

  const rpcs: Record<string, (p: Record<string, unknown>) => unknown> = {
    claim_work_snapshot: (p) => {
      if (!state.works.has(p.p_work_uuid as string)) return null;
      state.row ??= {
        work_uuid: p.p_work_uuid as string,
        object_path: null,
        draft_touched_at: null,
        generated_at: null,
        archive_bytes: null,
        manifest: null,
        retired: [],
        lease_id: null,
        lease_until: null,
        next_attempt_at: null,
        last_error: null,
      };
      const r = state.row;
      const free = !r.lease_until || Date.parse(r.lease_until) < clock.t;
      const due =
        !r.next_attempt_at || Date.parse(r.next_attempt_at) <= clock.t;
      if (!free || !due || r.object_path !== (p.p_expected_path ?? null)) {
        return null;
      }
      r.lease_id = `lease-${(leases += 1)}-0000-0000`;
      r.lease_until = iso(clock.t + (p.p_lease_seconds as number) * 1000);
      r.next_attempt_at = iso(
        clock.t + (p.p_interval_seconds as number) * 1000,
      );
      return r.lease_id;
    },
    complete_work_snapshot: (p) => {
      const r = state.row;
      if (!r || r.lease_id !== p.p_lease_id) return false;
      if (state.completeMode === 'error-not-committed')
        throw new Error('timeout');
      const pruned = p.p_pruned as string[];
      r.retired = [
        ...(r.retired ?? []).filter((e) => !pruned.includes(e.path)),
        ...(r.object_path ? [{ path: r.object_path, retired_at: iso() }] : []),
      ];
      Object.assign(r, {
        object_path: p.p_object_path,
        draft_touched_at: p.p_draft_touched_at,
        generated_at: p.p_generated_at,
        archive_bytes: p.p_archive_bytes,
        manifest: p.p_manifest,
        last_error: null,
        lease_id: null,
        lease_until: null,
      });
      if (state.completeMode === 'error-committed')
        throw new Error('lost reply');
      return true;
    },
    release_work_snapshot: (p) => {
      const r = state.row;
      if (!r || r.lease_id !== p.p_lease_id) return false;
      r.last_error = (p.p_error as string | null) ?? r.last_error;
      r.next_attempt_at = iso(clock.t + (p.p_backoff_seconds as number) * 1000);
      r.lease_id = null;
      r.lease_until = null;
      return true;
    },
  };

  const bucket = {
    upload: async (
      path: string,
      _body: unknown,
      opts: { upsert?: boolean },
    ) => {
      if (state.failUpload) return { error: { message: 'storage down' } };
      if (state.objects.has(path) && !opts.upsert) {
        return { error: { message: 'exists' } };
      }
      state.objects.set(path, { created_at: iso() });
      return { error: null };
    },
    list: async (prefix: string, opts: { limit: number; offset: number }) => ({
      data: [...state.objects.keys()]
        .filter((k) => k.startsWith(`${prefix}/`))
        .sort()
        .slice(opts.offset, opts.offset + opts.limit)
        .map((k) => ({
          name: k.slice(prefix.length + 1),
          created_at: state.objects.get(k)?.created_at,
        })),
      error: null,
    }),
    remove: async (paths: string[]) => {
      if (state.failRemove) return { data: null, error: { message: 'nope' } };
      const data = paths
        .filter((p) => state.objects.delete(p))
        .map((name) => ({ name }));
      return { data, error: null };
    },
    createSignedUrl: async (path: string) => {
      if (!state.objects.has(path)) {
        return { data: null, error: { message: 'Object not found' } };
      }
      state.signed.push(path);
      return { data: { signedUrl: `https://signed/${path}` }, error: null };
    },
  };

  const client = {
    from: (table: string) => {
      let value: unknown;
      const builder = {
        select: () => builder,
        eq: (_c: string, v: unknown) => ((value = v), builder),
        maybeSingle: async () => ({ data: single(table, value), error: null }),
      };
      return builder;
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      try {
        return { data: rpcs[name](params), error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },
    storage: { from: () => bucket },
  } as unknown as DataClient;

  return { client, state, clock, iso };
};

/** A generator that captures the live key first, as the real one does. */
const fakeGenerate = (
  backend: ReturnType<typeof fakeBackend>,
  opts: {
    gate?: Promise<void>;
    fail?: () => boolean;
    during?: () => void;
  } = {},
) => {
  const calls = { count: 0 };
  const generate = async (): Promise<WorkSnapshot | null> => {
    calls.count += 1;
    const key = backend.state.liveKey;
    await opts.gate;
    opts.during?.();
    if (opts.fail?.()) throw new Error('read failed');
    return {
      manifest: {
        formatVersion: SNAPSHOT_FORMAT_VERSION,
        tohs: ['toh1'],
        draftTouchedAt: key,
      } as unknown as SnapshotManifest,
      archive: Buffer.from('gz'),
    } as unknown as WorkSnapshot;
  };
  return { generate, calls };
};

const setup = () => {
  const backend = fakeBackend();
  const scheduled: (() => Promise<void>)[] = [];
  const gen = fakeGenerate(backend);
  const call = (overrides: Record<string, unknown> = {}) =>
    getWorkSnapshot({
      client: backend.client,
      work: 'toh1',
      schedule: (task) => scheduled.push(task),
      now: () => backend.clock.t,
      generate: gen.generate,
      ...overrides,
    });
  return { ...backend, scheduled, gen, call };
};

describe('getWorkSnapshot', () => {
  it('generates inline on first request and then serves it as current', async () => {
    const t = setup();
    const first = await t.call();
    expect(first).toMatchObject({
      status: 'ready',
      snapshot: { root: 'toh1', workUuid: WORK },
      freshness: { current: true, draftChangedSince: false, refreshing: false },
    });
    expect(t.state.objects.size).toBe(1);

    const second = await t.call();
    expect(second).toEqual(first);
    expect(t.gen.calls.count).toBe(1);
    expect(t.scheduled).toHaveLength(0);
  });

  it('generates once for concurrent first requests; the rest are told to retry', async () => {
    const t = setup();
    let open!: () => void;
    const gen = fakeGenerate(t, { gate: new Promise((r) => (open = r)) });
    const calls = Array.from({ length: 5 }, () =>
      t.call({ generate: gen.generate }),
    );
    await new Promise((r) => setTimeout(r, 0));
    open();
    const results = await Promise.all(calls);
    expect(gen.calls.count).toBe(1);
    expect(results.filter((r) => r.status === 'ready')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'generating')).toHaveLength(4);
  });

  it('serves a stale snapshot at once and refreshes it in the background', async () => {
    const t = setup();
    const first = await t.call();
    t.state.liveKey = '2026-10-13T10:01:00+00:00';
    t.clock.t += 3 * MIN;

    const stale = await t.call();
    expect(stale).toMatchObject({
      status: 'ready',
      snapshot: {
        snapshotId: (first as { snapshot: { snapshotId: string } }).snapshot
          .snapshotId,
      },
      freshness: {
        current: false,
        draftChangedSince: true,
        refreshing: true,
        ageMinutes: 3,
      },
    });
    expect(t.scheduled).toHaveLength(1);
    await t.scheduled[0]();

    const fresh = await t.call();
    expect(fresh).toMatchObject({
      status: 'ready',
      freshness: { current: true },
    });
    expect(t.state.row?.retired?.map((e) => e.path)).toEqual([
      (first as { snapshot: { snapshotId: string } }).snapshot.snapshotId,
    ]);
  });

  it('refreshes at most once per interval while the draft keeps changing', async () => {
    const t = setup();
    await t.call();
    t.clock.t += 3 * MIN;
    t.state.liveKey = '2026-10-13T10:02:00+00:00';
    await t.call();
    await t.scheduled[0]();

    t.clock.t += 30_000;
    t.state.liveKey = '2026-10-13T10:03:00+00:00';
    const again = await t.call();
    expect(again).toMatchObject({
      freshness: { current: false, refreshing: false },
    });
    expect(t.scheduled).toHaveLength(1);

    t.clock.t += S.refreshIntervalSeconds * 1000;
    await t.call();
    expect(t.scheduled).toHaveLength(2);
  });

  it('still serves a stale snapshot when the refresh claim errors', async () => {
    const t = setup();
    await t.call();
    t.state.liveKey = '2026-10-13T10:01:00+00:00';
    const rpc = t.client.rpc.bind(t.client);
    (t.client as unknown as { rpc: unknown }).rpc = async (
      name: string,
      params: Record<string, unknown>,
    ) =>
      name === 'claim_work_snapshot'
        ? { data: null, error: { message: 'connection reset' } }
        : rpc(name, params);
    expect(await t.call()).toMatchObject({
      status: 'ready',
      freshness: { current: false, refreshing: false },
    });
    expect(t.scheduled).toHaveLength(0);
  });

  it('refreshes an archive older than maxAge even when the key matches', async () => {
    const t = setup();
    await t.call();
    t.clock.t += S.maxAgeMs + MIN;
    const old = await t.call();
    expect(old).toMatchObject({
      freshness: { current: false, draftChangedSince: false, refreshing: true },
    });
    expect(t.scheduled).toHaveLength(1);
  });

  it('refreshes an archive in an older format even when the key matches', async () => {
    const t = setup();
    await t.call();
    if (t.state.row?.manifest) t.state.row.manifest.formatVersion = 1;
    t.clock.t += S.refreshIntervalSeconds * 1000 + MIN;
    const old = await t.call();
    expect(old).toMatchObject({
      status: 'ready',
      freshness: { current: false, draftChangedSince: false, refreshing: true },
    });
    expect(t.scheduled).toHaveLength(1);
  });

  it('treats an archive in a newer format as current', async () => {
    const t = setup();
    await t.call();
    if (t.state.row?.manifest)
      t.state.row.manifest.formatVersion = SNAPSHOT_FORMAT_VERSION + 1;
    const newer = await t.call();
    expect(newer).toMatchObject({
      status: 'ready',
      freshness: { current: true, refreshing: false },
    });
    expect(t.scheduled).toHaveLength(0);
  });

  it('records a failed generation, stores nothing, and backs off before retrying', async () => {
    const t = setup();
    let failing = true;
    const gen = fakeGenerate(t, { fail: () => failing });
    const failed = await t.call({ generate: gen.generate });
    expect(failed).toMatchObject({
      status: 'failed',
      error: 'Generation failed: read failed',
      retryAfterSeconds: S.failureBackoffSeconds,
    });
    expect(t.state.objects.size).toBe(0);

    t.clock.t += 10_000;
    expect(await t.call({ generate: gen.generate })).toMatchObject({
      status: 'failed',
    });
    expect(gen.calls.count).toBe(1);

    failing = false;
    t.clock.t += S.failureBackoffSeconds * 1000;
    expect(await t.call({ generate: gen.generate })).toMatchObject({
      status: 'ready',
    });
  });

  it('reports generating, not the old error, while a retry holds the lease', async () => {
    const t = setup();
    t.state.row = {
      work_uuid: WORK,
      object_path: null,
      draft_touched_at: null,
      generated_at: null,
      archive_bytes: null,
      manifest: null,
      retired: [],
      lease_id: 'someone',
      lease_until: t.iso(t.clock.t + 60_000),
      next_attempt_at: t.iso(t.clock.t + 60_000),
      last_error: 'earlier failure',
    };
    expect(await t.call()).toMatchObject({ status: 'generating' });
    expect(t.gen.calls.count).toBe(0);
  });

  it('answers not-found for an unknown work', async () => {
    const t = setup();
    expect(await t.call({ work: 'toh999' })).toEqual({ status: 'not-found' });
  });

  it('compares keys to the microsecond', () => {
    expect(
      sameDraftKey(
        '2026-10-13T10:00:00.123456+00:00',
        '2026-10-13T10:00:00.123457+00:00',
      ),
    ).toBe(false);
    expect(
      sameDraftKey(
        '2026-10-13T10:00:00.1+00:00',
        '2026-10-13T10:00:00.100000Z',
      ),
    ).toBe(true);
    expect(sameDraftKey(null, null)).toBe(true);
    expect(sameDraftKey(null, '2026-10-13T10:00:00Z')).toBe(false);
  });
});

describe('regenerate', () => {
  const claimed = async (t: ReturnType<typeof setup>) => {
    const { data } = await t.client.rpc('claim_work_snapshot', {
      p_work_uuid: WORK,
      p_expected_path: null,
      p_lease_seconds: S.leaseSeconds,
      p_interval_seconds: 0,
    });
    return data as string;
  };

  it('deletes its own upload when the lease was lost', async () => {
    const t = setup();
    const leaseId = await claimed(t);
    const gen = fakeGenerate(t, {
      during: () => {
        if (t.state.row) t.state.row.lease_id = 'taken-over';
      },
    });
    const outcome = await regenerate({
      client: t.client,
      workUuid: WORK,
      leaseId,
      now: () => t.clock.t,
      generate: gen.generate,
    });
    expect(outcome).toBe('lost');
    expect(t.state.objects.size).toBe(0);
    expect(t.state.row?.object_path).toBeNull();
  });

  it('keeps the upload when completion is ambiguous but committed', async () => {
    const t = setup();
    const leaseId = await claimed(t);
    t.state.completeMode = 'error-committed';
    const outcome = await regenerate({
      client: t.client,
      workUuid: WORK,
      leaseId,
      now: () => t.clock.t,
      generate: t.gen.generate,
    });
    expect(outcome).toBe('completed');
    expect(t.state.objects.has(t.state.row?.object_path ?? '')).toBe(true);
  });

  it('keeps the upload when completion is ambiguous and did not commit', async () => {
    const t = setup();
    const leaseId = await claimed(t);
    t.state.completeMode = 'error-not-committed';
    const outcome = await regenerate({
      client: t.client,
      workUuid: WORK,
      leaseId,
      now: () => t.clock.t,
      generate: t.gen.generate,
    });
    expect(outcome).toBe('ambiguous');
    expect(t.state.objects.size).toBe(1);
  });

  it('records an upload failure and releases the lease', async () => {
    const t = setup();
    const leaseId = await claimed(t);
    t.state.failUpload = true;
    const outcome = await regenerate({
      client: t.client,
      workUuid: WORK,
      leaseId,
      now: () => t.clock.t,
      generate: t.gen.generate,
    });
    expect(outcome).toBe('failed');
    expect(t.state.row).toMatchObject({
      lease_id: null,
      last_error: 'Upload failed: storage down',
    });
  });
});

describe('prune', () => {
  const row = (t: ReturnType<typeof setup>, over: Partial<WorkSnapshotRow>) =>
    ({
      work_uuid: WORK,
      object_path: `${WORK}/current.tar.gz`,
      retired: [],
      ...over,
    }) as WorkSnapshotRow;

  it('deletes retired objects past the grace period and orphans past the orphan age', async () => {
    const t = setup();
    const at = (ms: number) => t.iso(t.clock.t - ms);
    for (const name of ['current', 'old', 'recent', 'orphan', 'fresh-orphan']) {
      t.state.objects.set(`${WORK}/${name}.tar.gz`, {
        created_at: at(2 * S.orphanAgeMs),
      });
    }
    t.state.objects.set(`${WORK}/fresh-orphan.tar.gz`, { created_at: at(MIN) });

    const pruned = await prune({
      client: t.client,
      row: row(t, {
        retired: [
          { path: `${WORK}/old.tar.gz`, retired_at: at(S.retireGraceMs + MIN) },
          { path: `${WORK}/recent.tar.gz`, retired_at: at(MIN) },
          {
            path: `${WORK}/already-gone.tar.gz`,
            retired_at: at(S.retireGraceMs + MIN),
          },
        ],
      }),
      now: t.clock.t,
      settings: S,
    });

    expect(pruned.sort()).toEqual(
      [`${WORK}/already-gone.tar.gz`, `${WORK}/old.tar.gz`].sort(),
    );
    expect([...t.state.objects.keys()].sort()).toEqual(
      [
        `${WORK}/current.tar.gz`,
        `${WORK}/fresh-orphan.tar.gz`,
        `${WORK}/recent.tar.gz`,
      ].sort(),
    );
  });

  it('lists every page before deleting', async () => {
    const t = setup();
    for (let i = 0; i < 1005; i++) {
      t.state.objects.set(`${WORK}/o-${String(i).padStart(4, '0')}.tar.gz`, {
        created_at: t.iso(t.clock.t - 2 * S.orphanAgeMs),
      });
    }
    await prune({
      client: t.client,
      row: row(t, {}),
      now: t.clock.t,
      settings: S,
    });
    expect(t.state.objects.size).toBe(0);
  });

  it('forgets nothing when deletion fails', async () => {
    const t = setup();
    t.state.objects.set(`${WORK}/old.tar.gz`, { created_at: t.iso(0) });
    t.state.failRemove = true;
    const pruned = await prune({
      client: t.client,
      row: row(t, {
        retired: [{ path: `${WORK}/old.tar.gz`, retired_at: t.iso(0) }],
      }),
      now: t.clock.t,
      settings: S,
    });
    expect(pruned).toEqual([]);
    expect(t.state.objects.has(`${WORK}/old.tar.gz`)).toBe(true);
  });
});

describe('signSnapshot', () => {
  it('signs exactly the given archive with a download filename', async () => {
    const t = setup();
    const ready = await t.call();
    if (ready.status !== 'ready') throw new Error('expected ready');
    const signed = await signSnapshot({
      client: t.client,
      ref: ready.snapshot,
      now: () => t.clock.t,
    });
    expect(signed).toEqual({
      url: `https://signed/${ready.snapshot.snapshotId}`,
      filename: 'toh1-draft.tar.gz',
      expiresAt: t.iso(t.clock.t + S.urlTtlSeconds * 1000),
    });
  });
});
