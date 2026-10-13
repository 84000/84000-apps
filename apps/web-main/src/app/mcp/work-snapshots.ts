import {
  createWorkSnapshotCache,
  createWorkSnapshotSource,
  toWorkSnapshotStatus,
  type ReadyWorkSnapshot,
  type WorkSnapshotSource,
} from '@eightyfourthousand/lib-agent';
import {
  createBearerGraphQLClient,
  ensureWorkSnapshot,
} from '@eightyfourthousand/client-graphql/ssr';
import { untarGzTree } from '@eightyfourthousand/lib-publishing/ssr';

/** All snapshot work in one request finishes within this, under the route's 300 s. */
const REQUEST_BUDGET_MS = 280_000;
const ENSURE_TIMEOUT_MS = 240_000;
const DOWNLOAD_TIMEOUT_MS = 45_000;
/** Slack over the archive size the snapshot reports. */
const DOWNLOAD_SLACK_BYTES = 1024 * 1024;

const cacheMb = Number(process.env.MCP_SNAPSHOT_CACHE_MB);

// Process-wide, so warm instances reuse trees across requests.
const cache = createWorkSnapshotCache(
  process.env.MCP_SNAPSHOT_CACHE_MB && Number.isFinite(cacheMb) && cacheMb >= 0
    ? { maxBytes: cacheMb * 1024 * 1024 }
    : {},
);

/** Signed archive URLs must point at this project's storage. */
const storageOrigin = (): string | null => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return null;
  }
};

/** The response body, refusing more than `limit` bytes. */
const readCapped = async (response: Response, limit: number) => {
  const declared = Number(response.headers.get('content-length'));
  if (declared > limit) throw new Error('Snapshot archive is too large');
  if (!response.body) throw new Error('Snapshot download has no body');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error('Snapshot archive is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

/**
 * The snapshot tools' source for one request. Calls api-graphql with the
 * caller's own `Authorization` header, which authorizes every call there; this
 * route never holds a service credential. Everything stops when `signal` fires
 * or the request's time budget runs out.
 */
export const workSnapshotSource = (
  authorization: string,
  signal: AbortSignal,
): WorkSnapshotSource => {
  const client = createBearerGraphQLClient(authorization);
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  const within = (ms: number) =>
    AbortSignal.any([
      signal,
      AbortSignal.timeout(Math.max(0, Math.min(ms, deadline - Date.now()))),
    ]);

  return createWorkSnapshotSource({
    cache,
    ensure: async (work, { download }) =>
      toWorkSnapshotStatus(
        await ensureWorkSnapshot({
          client,
          work,
          withDownload: download,
          signal: within(ENSURE_TIMEOUT_MS),
        }),
      ),
    fetchFiles: async ({ url }, snapshot: ReadyWorkSnapshot) => {
      const origin = storageOrigin();
      if (!origin || new URL(url).origin !== origin) {
        throw new Error('Snapshot download URL is not on project storage');
      }
      // A load shared by concurrent requests stops with the request that
      // started it; the others then load again on their retry.
      const response = await fetch(url, {
        redirect: 'error',
        signal: within(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Snapshot download failed: HTTP ${response.status}`);
      }
      const archive = await readCapped(
        response,
        snapshot.archiveBytes > 0
          ? snapshot.archiveBytes + DOWNLOAD_SLACK_BYTES
          : Infinity,
      );
      const { root, tree } = untarGzTree(archive);
      if (root !== snapshot.root) {
        throw new Error(
          `Snapshot archive root ${root} does not match ${snapshot.root}`,
        );
      }
      return tree;
    },
  });
};
