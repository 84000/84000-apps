/**
 * Draft snapshot cache: one stored snapshot per work, served while it matches the
 * draft and regenerated one at a time, at most once per refresh interval.
 *
 * Everything here needs a service_role client: the bucket and `work_snapshots` have no
 * user access at all. Authorization is the caller's job; never infer it from this
 * client.
 *
 * A snapshot is current while the `draft_touched_at` it was built from equals the live
 * one and its format is this build's. Inputs no trigger tracks (alignment matview
 * refreshes) are picked up only once an archive outlives `maxAgeMs`.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { generateWorkSnapshot, type WorkSnapshot } from './generate';
import { resolveDraftWork } from './read-draft';
import { SNAPSHOT_FORMAT_VERSION, type SnapshotManifest } from './render';

export const SNAPSHOT_BUCKET = 'work-snapshots';

export interface SnapshotStoreSettings {
  /** Earliest re-claim after a claim: active editing regenerates at most this often. */
  refreshIntervalSeconds: number;
  /** Earliest re-claim after a failed generation. */
  failureBackoffSeconds: number;
  /** An archive older than this is refreshed even when the key still matches. */
  maxAgeMs: number;
  /** Outlives the 300 s function limit, so a killed holder's lease frees itself. */
  leaseSeconds: number;
  /** Lifetime of a signed download URL. */
  urlTtlSeconds: number;
  /** A retired object is deleted this long after retirement: URL TTL plus a margin. */
  retireGraceMs: number;
  /** An object that never became current is deleted once this old (lease + margin). */
  orphanAgeMs: number;
}

export const SNAPSHOT_STORE_SETTINGS: SnapshotStoreSettings = {
  refreshIntervalSeconds: 120,
  failureBackoffSeconds: 30,
  maxAgeMs: 24 * 60 * 60 * 1000,
  leaseSeconds: 330,
  urlTtlSeconds: 15 * 60,
  retireGraceMs: 20 * 60 * 1000,
  orphanAgeMs: (330 + 300) * 1000,
};

/** One stored snapshot. `snapshotId` is its object path: immutable per generation. */
export interface WorkSnapshotRef {
  workUuid: string;
  snapshotId: string;
  /** The archive's top-level directory (first Toh, else the work uuid). */
  root: string;
  generatedAt: string;
  /** Compressed size. */
  archiveBytes: number;
  manifest: SnapshotManifest;
}

export interface SnapshotFreshness {
  /** The stored key equals the live draft key, the archive is within maxAge, and its format is current. */
  current: boolean;
  /** The draft has changed since the snapshot was built. */
  draftChangedSince: boolean;
  generatedAt: string;
  ageMinutes: number;
  /** A regeneration holds the lease right now. */
  refreshing: boolean;
}

export type GetWorkSnapshotResult =
  | { status: 'ready'; snapshot: WorkSnapshotRef; freshness: SnapshotFreshness }
  | { status: 'not-found' }
  | { status: 'generating'; retryAfterSeconds: number }
  | { status: 'failed'; error: string; retryAfterSeconds: number };

export interface RetiredEntry {
  path: string;
  retired_at: string;
}

/** A `work_snapshots` row. */
export interface WorkSnapshotRow {
  work_uuid: string;
  object_path: string | null;
  draft_touched_at: string | null;
  generated_at: string | null;
  archive_bytes: number | null;
  manifest: SnapshotManifest | null;
  retired: RetiredEntry[] | null;
  lease_id: string | null;
  lease_until: string | null;
  next_attempt_at: string | null;
  last_error: string | null;
}

type Generate = (args: {
  client: DataClient;
  work: string;
}) => Promise<WorkSnapshot | null>;

interface StoreDeps {
  /** A service_role client. */
  client: DataClient;
  now?: () => number;
  settings?: SnapshotStoreSettings;
  /** Injectable for specs. */
  generate?: Generate;
}

const ROW_COLUMNS =
  'work_uuid, object_path, draft_touched_at, generated_at, archive_bytes, manifest, ' +
  'retired, lease_id, lease_until, next_attempt_at, last_error';

const log = (message: string, error?: unknown) =>
  console.error(`[work-snapshots] ${message}`, error ?? '');

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Compares two timestamptz strings to the microsecond, which `Date` cannot. */
export const sameDraftKey = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  if (a == null || b == null) return a == null && b == null;
  const micros = (value: string) => {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return value;
    const fraction = /\.(\d+)/.exec(value)?.[1] ?? '';
    return `${Math.floor(ms / 1000)}.${fraction.padEnd(6, '0').slice(0, 6)}`;
  };
  return micros(a) === micros(b);
};

const readRow = async (
  client: DataClient,
  workUuid: string,
): Promise<WorkSnapshotRow | null> => {
  const { data, error } = await client
    .from('work_snapshots')
    .select(ROW_COLUMNS)
    .eq('work_uuid', workUuid)
    .maybeSingle();
  if (error) throw new Error(`Reading work_snapshots: ${error.message}`);
  return (data as WorkSnapshotRow | null) ?? null;
};

const leaseHeld = (row: WorkSnapshotRow, now: number) =>
  !!row.lease_id && !!row.lease_until && Date.parse(row.lease_until) > now;

const refOf = (row: WorkSnapshotRow): WorkSnapshotRef | null => {
  if (!row.object_path || !row.manifest || !row.generated_at) return null;
  return {
    workUuid: row.work_uuid,
    snapshotId: row.object_path,
    root: row.manifest.tohs[0] ?? row.work_uuid,
    generatedAt: row.generated_at,
    archiveBytes: row.archive_bytes ?? 0,
    manifest: row.manifest,
  };
};

const freshnessOf = ({
  row,
  liveKey,
  now,
  settings,
  refreshing,
}: {
  row: WorkSnapshotRow;
  liveKey: string | null;
  now: number;
  settings: SnapshotStoreSettings;
  refreshing: boolean;
}): SnapshotFreshness => {
  const generatedAt = row.generated_at ?? new Date(now).toISOString();
  const age = Math.max(0, now - Date.parse(generatedAt));
  const sameKey = sameDraftKey(row.draft_touched_at, liveKey);
  return {
    current:
      sameKey &&
      age < settings.maxAgeMs &&
      row.manifest?.formatVersion === SNAPSHOT_FORMAT_VERSION,
    draftChangedSince: !sameKey,
    generatedAt,
    ageMinutes: Math.floor(age / 60_000),
    refreshing,
  };
};

const claim = async ({
  client,
  workUuid,
  expectedPath,
  settings,
}: {
  client: DataClient;
  workUuid: string;
  expectedPath: string | null;
  settings: SnapshotStoreSettings;
}): Promise<string | null> => {
  const { data, error } = await client.rpc('claim_work_snapshot', {
    p_work_uuid: workUuid,
    p_expected_path: expectedPath,
    p_lease_seconds: settings.leaseSeconds,
    p_interval_seconds: settings.refreshIntervalSeconds,
  });
  if (error) throw new Error(`Claiming the snapshot lease: ${error.message}`);
  return (data as string | null) ?? null;
};

/**
 * The answer after a cold claim, won or lost. A held lease outranks a recorded error,
 * since a retry runs with the previous error still on the row.
 */
const settle = ({
  row,
  liveKey,
  now,
  settings,
}: {
  row: WorkSnapshotRow | null;
  liveKey: string | null;
  now: number;
  settings: SnapshotStoreSettings;
}): GetWorkSnapshotResult => {
  if (!row) return { status: 'not-found' };
  const ref = refOf(row);
  if (ref) {
    return {
      status: 'ready',
      snapshot: ref,
      freshness: freshnessOf({
        row,
        liveKey,
        now,
        settings,
        refreshing: leaseHeld(row, now),
      }),
    };
  }
  const retryAfter = (until: string | null, fallback: number) =>
    Math.max(1, until ? Math.ceil((Date.parse(until) - now) / 1000) : fallback);
  if (leaseHeld(row, now)) {
    return { status: 'generating', retryAfterSeconds: 15 };
  }
  if (
    row.last_error &&
    row.next_attempt_at &&
    Date.parse(row.next_attempt_at) > now
  ) {
    return {
      status: 'failed',
      error: row.last_error,
      retryAfterSeconds: retryAfter(
        row.next_attempt_at,
        settings.failureBackoffSeconds,
      ),
    };
  }
  return { status: 'generating', retryAfterSeconds: 5 };
};

/**
 * The work's snapshot. A stale one is returned at once, with a refresh handed to
 * `schedule` if this call wins the claim. With none yet, the caller that wins the claim
 * generates inline and the others are told to retry.
 */
export const getWorkSnapshot = async ({
  client,
  work,
  schedule,
  now = Date.now,
  settings = SNAPSHOT_STORE_SETTINGS,
  generate = generateWorkSnapshot,
}: StoreDeps & {
  /** A Toh or a work uuid. */
  work: string;
  schedule: (task: () => Promise<void>) => void;
}): Promise<GetWorkSnapshotResult> => {
  const resolved = await resolveDraftWork({ client, work });
  if (!resolved) return { status: 'not-found' };
  const workUuid = resolved.uuid;
  const deps = { client, now, settings, generate };

  const row = await readRow(client, workUuid);
  const ref = row && refOf(row);

  if (row && ref) {
    const at = now();
    const freshness = freshnessOf({
      row,
      liveKey: resolved.draftTouchedAt,
      now: at,
      settings,
      refreshing: leaseHeld(row, at),
    });
    if (freshness.current) return { status: 'ready', snapshot: ref, freshness };

    // A stale snapshot is still worth serving if the refresh cannot be claimed.
    const lease = await claim({
      client,
      workUuid,
      expectedPath: ref.snapshotId,
      settings,
    }).catch((error) => {
      log(`Claiming a refresh of ${workUuid}`, error);
      return null;
    });
    if (lease) {
      schedule(async () => {
        try {
          await regenerate({ ...deps, workUuid, leaseId: lease });
        } catch (error) {
          log(`Refresh of ${workUuid} failed`, error);
        }
      });
    }
    return {
      status: 'ready',
      snapshot: ref,
      freshness: { ...freshness, refreshing: freshness.refreshing || !!lease },
    };
  }

  const lease = await claim({ client, workUuid, expectedPath: null, settings });
  if (lease) await regenerate({ ...deps, workUuid, leaseId: lease });

  // The row now says what happened; re-read the live key too, as time has passed.
  const live = await resolveDraftWork({ client, work: workUuid });
  return settle({
    row: live ? await readRow(client, workUuid) : null,
    liveKey: live?.draftTouchedAt ?? null,
    now: now(),
    settings,
  });
};

type RegenerateOutcome = 'completed' | 'failed' | 'gone' | 'lost' | 'ambiguous';

/**
 * Builds and publishes a new snapshot while holding `leaseId`. Generation and upload
 * failures are recorded on the row rather than thrown.
 */
export const regenerate = async ({
  client,
  workUuid,
  leaseId,
  now = Date.now,
  settings = SNAPSHOT_STORE_SETTINGS,
  generate = generateWorkSnapshot,
}: StoreDeps & {
  workUuid: string;
  leaseId: string;
}): Promise<RegenerateOutcome> => {
  const release = async (error: string | null) => {
    const { error: rpcError } = await client.rpc('release_work_snapshot', {
      p_work_uuid: workUuid,
      p_lease_id: leaseId,
      p_error: error,
      p_backoff_seconds: settings.failureBackoffSeconds,
    });
    if (rpcError) log(`Releasing the lease on ${workUuid}`, rpcError.message);
  };

  const generatedAt = new Date(now()).toISOString();
  let snapshot: WorkSnapshot | null;
  try {
    snapshot = await generate({ client, work: workUuid });
  } catch (error) {
    await release(`Generation failed: ${errorText(error)}`);
    return 'failed';
  }
  if (!snapshot) {
    await release('Work not found');
    return 'gone';
  }

  const row = await readRow(client, workUuid).catch((error) => {
    log(`Reading ${workUuid} before pruning`, error);
    return null;
  });
  const pruned = row ? await prune({ client, row, now: now(), settings }) : [];

  const label = snapshot.manifest.draftTouchedAt
    ? String(Date.parse(snapshot.manifest.draftTouchedAt))
    : 'untouched';
  const path = `${workUuid}/${label}-${leaseId.slice(0, 8)}.tar.gz`;
  const { error: uploadError } = await client.storage
    .from(SNAPSHOT_BUCKET)
    .upload(
      path,
      new Blob([new Uint8Array(snapshot.archive)], {
        type: 'application/gzip',
      }),
      { contentType: 'application/gzip', upsert: false },
    );
  if (uploadError) {
    await release(`Upload failed: ${uploadError.message}`);
    return 'failed';
  }

  const { data: completed, error: completeError } = await client.rpc(
    'complete_work_snapshot',
    {
      p_work_uuid: workUuid,
      p_lease_id: leaseId,
      p_object_path: path,
      p_draft_touched_at: snapshot.manifest.draftTouchedAt,
      p_generated_at: generatedAt,
      p_archive_bytes: snapshot.archive.length,
      p_manifest: snapshot.manifest,
      p_pruned: pruned,
    },
  );

  if (completeError) {
    // The update may have committed or still be pending, so keep the upload; a later
    // prune classifies it. The lease is left to expire.
    log(`Completing ${workUuid} (outcome unknown)`, completeError.message);
    const after = await readRow(client, workUuid).catch(() => null);
    return after?.object_path === path ? 'completed' : 'ambiguous';
  }
  if (completed !== true) {
    // Lease lost: this object never became current, so nothing can have signed it.
    const { error } = await client.storage.from(SNAPSHOT_BUCKET).remove([path]);
    if (error) log(`Removing the losing upload ${path}`, error.message);
    return 'lost';
  }
  return 'completed';
};

/**
 * Deletes a work's retired objects past the grace period and its orphans (never
 * current) past the orphan age. Returns the retired paths confirmed gone. Never throws.
 */
export const prune = async ({
  client,
  row,
  now,
  settings,
}: {
  client: DataClient;
  row: WorkSnapshotRow;
  now: number;
  settings: SnapshotStoreSettings;
}): Promise<string[]> => {
  const bucket = client.storage.from(SNAPSHOT_BUCKET);
  const prefix = row.work_uuid;
  try {
    // List everything before deleting: deleting while paging by offset skips objects.
    const listed: { path: string; createdAt: number }[] = [];
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await bucket.list(prefix, {
        limit: PAGE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        listed.push({
          path: `${prefix}/${item.name}`,
          createdAt: Date.parse(item.created_at ?? '') || now,
        });
      }
      if ((data ?? []).length < PAGE) break;
    }
    const present = new Set(listed.map((o) => o.path));
    const retired = row.retired ?? [];
    const retiredPaths = new Set(retired.map((e) => e.path));

    const expired = retired
      .filter((e) => now - Date.parse(e.retired_at) > settings.retireGraceMs)
      .map((e) => e.path);
    const orphans = listed
      .filter(
        (o) =>
          o.path !== row.object_path &&
          !retiredPaths.has(o.path) &&
          now - o.createdAt > settings.orphanAgeMs,
      )
      .map((o) => o.path);

    const doomed = [...expired.filter((p) => present.has(p)), ...orphans];
    const removed = new Set<string>();
    if (doomed.length) {
      const { data, error } = await bucket.remove(doomed);
      if (error) log(`Pruning ${prefix}`, error.message);
      for (const item of data ?? []) removed.add(item.name);
    }
    return expired.filter((p) => removed.has(p) || !present.has(p));
  } catch (error) {
    log(`Pruning ${prefix}`, error);
    return [];
  }
};

/** A short-lived download URL for exactly `ref`'s archive. */
export const signSnapshot = async ({
  client,
  ref,
  now = Date.now,
  settings = SNAPSHOT_STORE_SETTINGS,
}: {
  client: DataClient;
  ref: WorkSnapshotRef;
  now?: () => number;
  settings?: SnapshotStoreSettings;
}): Promise<{ url: string; expiresAt: string; filename: string }> => {
  const filename = `${ref.root}-draft.tar.gz`;
  const issued = now();
  const { data, error } = await client.storage
    .from(SNAPSHOT_BUCKET)
    .createSignedUrl(ref.snapshotId, settings.urlTtlSeconds, {
      download: filename,
    });
  if (error || !data?.signedUrl) {
    throw new Error(
      `Signing the snapshot failed: ${error?.message ?? 'no URL returned'}`,
    );
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(issued + settings.urlTtlSeconds * 1000).toISOString(),
    filename,
  };
};
