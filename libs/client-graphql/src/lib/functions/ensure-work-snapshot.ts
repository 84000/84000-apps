import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import type { WorkSnapshot } from '../generated/graphql';

export type { SnapshotDownload, WorkSnapshot } from '../generated/graphql';

const ENSURE_WORK_SNAPSHOT = gql`
  mutation EnsureWorkSnapshot($work: String!, $withDownload: Boolean!) {
    ensureWorkSnapshot(work: $work) {
      status
      snapshotId
      workUuid
      root
      generatedAt
      current
      draftChangedSince
      ageMinutes
      refreshing
      archiveBytes
      manifest
      retryAfterSeconds
      error
      download @include(if: $withDownload) {
        url
        expiresAt
        filename
      }
    }
  }
`;

/**
 * The outcome of `ensureWorkSnapshot`: the snapshot, or why the request did not
 * return one. `aborted` means the caller's signal fired first, which says nothing
 * about the generation itself: it keeps running server-side.
 */
export type EnsureWorkSnapshotResult =
  | { snapshot: WorkSnapshot; error: null; aborted: false }
  | { snapshot: null; error: string; aborted: boolean };

const isAbort = (error: unknown, signal?: AbortSignal): boolean =>
  Boolean(signal?.aborted) ||
  (error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError'));

/** A permission failure is passed on as the resolver worded it; anything else is generic. */
const failureMessage = (error: unknown): string => {
  const response = (
    error as { response?: { errors?: { message?: string }[] } } | undefined
  )?.response;
  const message = response?.errors?.[0]?.message?.trim() ?? '';
  return message.startsWith('Permission denied')
    ? message
    : 'The work snapshot request failed.';
};

/**
 * Ensure a work's draft snapshot exists and return it, building it on first request.
 *
 * Requires `editor.read`, checked server-side against the client's credentials.
 * A stale snapshot comes back at once with `refreshing` set while a newer one is
 * built; a first build runs inline, so the call can take as long as the build.
 * Pass `withDownload` to also sign a short-lived URL for exactly this archive.
 * Never throws: failures come back as `error`.
 */
export async function ensureWorkSnapshot({
  client,
  work,
  withDownload = false,
  signal,
}: {
  client: GraphQLClient;
  /** Work uuid or Toh key ("toh8"). */
  work: string;
  withDownload?: boolean;
  signal?: AbortSignal;
}): Promise<EnsureWorkSnapshotResult> {
  try {
    const response = await client.request<{ ensureWorkSnapshot: WorkSnapshot }>(
      {
        document: ENSURE_WORK_SNAPSHOT,
        variables: { work, withDownload },
        signal,
      },
    );
    return {
      snapshot: response.ensureWorkSnapshot,
      error: null,
      aborted: false,
    };
  } catch (error) {
    if (isAbort(error, signal)) {
      return {
        snapshot: null,
        error: 'The work snapshot request timed out.',
        aborted: true,
      };
    }
    console.error('Error ensuring work snapshot:', error);
    return { snapshot: null, error: failureMessage(error), aborted: false };
  }
}
