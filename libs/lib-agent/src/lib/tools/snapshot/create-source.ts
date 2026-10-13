import type { WorkSnapshotCache } from './cache';
import type {
  ReadyWorkSnapshot,
  WorkSnapshotDownload,
  WorkSnapshotFiles,
  WorkSnapshotManifest,
  WorkSnapshotSource,
  WorkSnapshotStatus,
} from './source';

/** Seconds to suggest waiting after the snapshot request itself timed out. */
export const TIMED_OUT_RETRY_SECONDS = 30;

/** The `ensureWorkSnapshot` GraphQL result, as the tools read it. */
export interface EnsureWorkSnapshotResponse {
  snapshot: {
    status: string;
    snapshotId?: string | null;
    workUuid?: string | null;
    root?: string | null;
    generatedAt?: string | null;
    current?: boolean | null;
    draftChangedSince?: boolean | null;
    ageMinutes?: number | null;
    refreshing?: boolean | null;
    archiveBytes?: number | null;
    manifest?: unknown;
    retryAfterSeconds?: number | null;
    error?: string | null;
    download?: WorkSnapshotDownload | null;
  } | null;
  error: string | null;
  /** The request was cut off by the caller's timeout. */
  aborted: boolean;
}

/** Map an `ensureWorkSnapshot` result to the status the tools act on. */
export const toWorkSnapshotStatus = (
  response: EnsureWorkSnapshotResponse,
): WorkSnapshotStatus => {
  const { snapshot } = response;
  if (!snapshot) {
    // The generation outlives the request, so a timeout is worth retrying.
    return response.aborted
      ? { status: 'generating', retryAfterSeconds: TIMED_OUT_RETRY_SECONDS }
      : { status: 'error', error: response.error ?? 'Request failed.' };
  }
  switch (snapshot.status) {
    case 'READY':
      if (!snapshot.snapshotId || !snapshot.workUuid || !snapshot.root) break;
      return {
        status: 'ready',
        snapshotId: snapshot.snapshotId,
        workUuid: snapshot.workUuid,
        root: snapshot.root,
        generatedAt: snapshot.generatedAt ?? '',
        current: snapshot.current ?? false,
        draftChangedSince: snapshot.draftChangedSince ?? false,
        ageMinutes: snapshot.ageMinutes ?? 0,
        refreshing: snapshot.refreshing ?? false,
        archiveBytes: snapshot.archiveBytes ?? 0,
        manifest: (snapshot.manifest ?? {}) as WorkSnapshotManifest,
        download: snapshot.download ?? null,
      };
    case 'GENERATING':
      return {
        status: 'generating',
        retryAfterSeconds:
          snapshot.retryAfterSeconds ?? TIMED_OUT_RETRY_SECONDS,
      };
    case 'FAILED':
      return {
        status: 'failed',
        error: snapshot.error ?? 'Snapshot generation failed.',
        retryAfterSeconds:
          snapshot.retryAfterSeconds ?? TIMED_OUT_RETRY_SECONDS,
      };
    case 'NOT_FOUND':
      return { status: 'not-found' };
  }
  return { status: 'error', error: 'Unexpected snapshot response.' };
};

/**
 * Build a `WorkSnapshotSource` from the host's request and download functions,
 * serving trees from `cache` by snapshot id.
 *
 * On a cache miss the work is ensured again with a signed URL, which may name a
 * newer snapshot. A failed download is retried once with a fresh URL, since the
 * archive may have been retired and pruned between the two requests.
 *
 * `files` serves only snapshots this source's `ensure` returned, so every tree
 * it hands out was authorized for this caller.
 */
export const createWorkSnapshotSource = ({
  ensure,
  fetchFiles,
  cache,
}: {
  /** Request the snapshot, authorizing the caller. */
  ensure: (
    work: string,
    options: { download: boolean },
  ) => Promise<WorkSnapshotStatus>;
  /** Download and unpack the snapshot's archive. Throws on failure. */
  fetchFiles: (
    download: WorkSnapshotDownload,
    snapshot: ReadyWorkSnapshot,
  ) => Promise<WorkSnapshotFiles>;
  cache: WorkSnapshotCache;
}): WorkSnapshotSource => {
  const issued = new Set<string>();
  const authorized = async (
    work: string,
    download: boolean,
  ): Promise<WorkSnapshotStatus> => {
    const result = await ensure(work, { download });
    if (result.status === 'ready') issued.add(result.snapshotId);
    return result;
  };

  const signed = async (
    workUuid: string,
  ): Promise<ReadyWorkSnapshot | null> => {
    const result = await authorized(workUuid, true);
    return result.status === 'ready' && result.download ? result : null;
  };

  const loadSigned = async (snapshot: ReadyWorkSnapshot) => {
    const download = snapshot.download;
    if (!download) return null;
    const files = await cache.load(snapshot.snapshotId, () =>
      fetchFiles(download, snapshot),
    );
    return { snapshot, files };
  };

  return {
    ensure: (work, options) => authorized(work, options?.download ?? false),
    files: async (snapshot) => {
      if (!issued.has(snapshot.snapshotId)) return null;
      const cached = cache.get(snapshot.snapshotId);
      if (cached) return { snapshot, files: cached };
      for (let attempt = 0; attempt < 2; attempt++) {
        const target =
          attempt === 0 && snapshot.download
            ? snapshot
            : await signed(snapshot.workUuid);
        if (!target) return null;
        const hit = cache.get(target.snapshotId);
        if (hit) return { snapshot: target, files: hit };
        try {
          return await loadSigned(target);
        } catch (error) {
          console.error('Error loading work snapshot:', error);
        }
      }
      return null;
    },
  };
};
