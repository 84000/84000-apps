/**
 * Stored bundle archives, under `bundles/` in the service_role-only `work-snapshots`
 * bucket, and signing any stored archive for download.
 */

import { createHash } from 'node:crypto';
import type { DataClient } from '@eightyfourthousand/data-access';
import { SNAPSHOT_BUCKET } from '../snapshot/store';

export const BUNDLE_BUCKET = SNAPSHOT_BUCKET;
export const BUNDLE_PREFIX = 'bundles';

/**
 * Bundles are stored per window of this length: one is reused until its window ends,
 * then built again under the next window's path.
 */
export const BUNDLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Lifetime of a signed download URL. */
export const BUNDLE_URL_TTL_SECONDS = 15 * 60;

/** Stored bundles are pruned once older than this: a window, any URL signed in it, and a margin. */
export const BUNDLE_PRUNE_AFTER_MS =
  BUNDLE_MAX_AGE_MS + BUNDLE_URL_TTL_SECONDS * 1000 + 60 * 60 * 1000;

/** The bucket's own object size limit. */
export const BUNDLE_OBJECT_LIMIT_BYTES = 100 * 1024 * 1024;

/**
 * Where a bundle's own archive is stored in the window holding `now`. Objects are
 * written once and never replaced, so a signed URL and its hash always agree.
 */
export const bundleObjectPath = (bundleId: string, now: number): string =>
  `${BUNDLE_PREFIX}/${bundleId}-${Math.floor(now / BUNDLE_MAX_AGE_MS)}.tar.gz`;

/** Bundle archive storage, injectable for specs. */
export interface BundleStore {
  /** When the object was last written, or null when absent. Throws when storage fails. */
  find(path: string): Promise<{ storedAt: number; bytes: number } | null>;
  /**
   * Stores the object unless one is already there: false when another request stored
   * it first. Throws when storage fails.
   */
  put(path: string, body: Buffer): Promise<boolean>;
  /** Deletes bundles older than `BUNDLE_PRUNE_AFTER_MS`. Never throws. */
  prune(now: number): Promise<void>;
  /**
   * The sha256 of a stored object, downloading it once per `version` (any string that
   * changes when the object does). Throws when storage fails.
   */
  sha256(bucket: string, path: string, version: string): Promise<string>;
}

/** Both the listing page and the most objects one `remove` call may delete. */
const PAGE = 1000;

/** Storage's answer to creating an object that exists. */
const isDuplicate = (error: { message?: string; statusCode?: string }) =>
  error.statusCode === '409' ||
  /already exists|duplicate/i.test(error.message ?? '');

/** When the object was last written. */
const storedAt = (item: {
  updated_at?: string | null;
  created_at?: string | null;
}): number => Date.parse(item.updated_at ?? item.created_at ?? '') || 0;

/** Hashes of stored objects by bucket, path and version, kept for the process. */
const hashes = new Map<string, Promise<string>>();
const MAX_HASHES = 1000;

/** The bundle store on a service_role client. */
export const createBundleStore = (client: DataClient): BundleStore => {
  const bucket = () => client.storage.from(BUNDLE_BUCKET);
  return {
    find: async (path) => {
      const name = path.slice(BUNDLE_PREFIX.length + 1);
      // `list` reports a refusal as an error; `exists` would read it as absent.
      // Its search is a prefix match, so compare names exactly.
      const { data, error } = await bucket().list(BUNDLE_PREFIX, {
        search: name,
        limit: 10,
      });
      if (error) throw new Error(`Looking up ${path}: ${error.message}`);
      const found = (data ?? []).find((item) => item.name === name);
      if (!found) return null;
      const size = Number(
        (found.metadata as { size?: unknown } | null)?.size ?? 0,
      );
      return {
        storedAt: storedAt(found),
        bytes: Number.isFinite(size) ? size : 0,
      };
    },
    put: async (path, body) => {
      const { error } = await bucket().upload(
        path,
        new Blob([new Uint8Array(body)], { type: 'application/gzip' }),
        { contentType: 'application/gzip', upsert: false },
      );
      if (!error) return true;
      if (isDuplicate(error as { message?: string; statusCode?: string })) {
        return false;
      }
      throw new Error(`Uploading ${path}: ${error.message}`);
    },
    prune: async (now) => {
      try {
        const doomed: string[] = [];
        for (let offset = 0; ; offset += PAGE) {
          const { data, error } = await bucket().list(BUNDLE_PREFIX, {
            limit: PAGE,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          });
          if (error) throw new Error(error.message);
          for (const item of data ?? []) {
            const stored = storedAt(item);
            if (stored && now - stored > BUNDLE_PRUNE_AFTER_MS) {
              doomed.push(`${BUNDLE_PREFIX}/${item.name}`);
            }
          }
          if ((data ?? []).length < PAGE) break;
        }
        for (let start = 0; start < doomed.length; start += PAGE) {
          const { error } = await bucket().remove(
            doomed.slice(start, start + PAGE),
          );
          if (error) throw new Error(error.message);
        }
      } catch (error) {
        console.error('Pruning stored bundles failed:', error);
      }
    },
    sha256: (bucketId, path, version) => {
      const key = `${bucketId}/${path}@${version}`;
      const known = hashes.get(key);
      if (known) return known;
      const hashing = (async () => {
        const { data, error } = await client.storage
          .from(bucketId)
          .download(path);
        if (error || !data) {
          throw new Error(
            `Reading ${bucketId}/${path}: ${error?.message ?? 'no data'}`,
          );
        }
        const body = Buffer.from(await data.arrayBuffer());
        return createHash('sha256').update(body).digest('hex');
      })();
      if (hashes.size >= MAX_HASHES) hashes.clear();
      hashes.set(key, hashing);
      hashing.catch(() => hashes.delete(key));
      return hashing;
    },
  };
};

/** A signed, short-lived download. */
export interface SignedDownload {
  url: string;
  expiresAt: string;
  filename: string;
}

/** A short-lived download URL for one stored archive, or null if signing fails. */
export const signStoredArchive = async ({
  client,
  bucket,
  path,
  filename,
  now = Date.now,
}: {
  client: DataClient;
  bucket: string;
  path: string;
  filename: string;
  now?: () => number;
}): Promise<SignedDownload | null> => {
  const issued = now();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, BUNDLE_URL_TTL_SECONDS, { download: filename });
  if (error || !data?.signedUrl) {
    console.error(
      `Signing ${bucket}/${path} failed: ${error?.message ?? 'no URL returned'}`,
    );
    return null;
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(issued + BUNDLE_URL_TTL_SECONDS * 1000).toISOString(),
    filename,
  };
};
