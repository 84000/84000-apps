import { DataClient } from './types';

/**
 * Bucket-agnostic storage primitives shared by the buckets that keep their own
 * revision history — `translation-harness` (policies) and `translation-sessions`
 * (session documents). Nothing here widens access: RLS is the gate.
 */

/** Append-only prefix holding prior revisions; RLS denies UPDATE and DELETE on it. */
export const ARCHIVE_PREFIX = 'archive';

/** `20260908T193000Z` — sorts chronologically, needs no escaping in a key. */
export const archiveStamp = (at: Date = new Date()) =>
  at
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');

/** The extension including its dot, or `''` for a name that has none. */
export const extensionOf = (path: string) => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
};

const CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * Content type is derived from the extension rather than taken from the caller.
 * For a signed upload the client sets the header itself, so this is what the
 * write tool tells it to send.
 */
export const contentTypeFor = (path: string) =>
  CONTENT_TYPES[extensionOf(path).toLowerCase()] ?? DEFAULT_CONTENT_TYPE;

const TEXT_EXTENSIONS = new Set(['.md', '.json', '.txt']);

/** Whether the object can usefully be returned to a model as text. */
export const isTextPath = (path: string) =>
  TEXT_EXTENSIONS.has(extensionOf(path).toLowerCase());

/**
 * `archive/<path>/<stamp><ext>`. The live key becomes a folder holding its own
 * revisions, so the extension is repeated on the stamp — otherwise an archived
 * `.docx` would lose its type, and a reader could not tell what it is.
 *
 * The stamp is second-granularity, so two writes to the *same* path inside one
 * second collide. Because the archive denies UPDATE the second copy then fails
 * and its write is abandoned, which is the safe direction. A batch writing
 * several distinct paths is unaffected.
 */
export const archivedObjectPath = ({
  path,
  at = new Date(),
}: {
  path: string;
  at?: Date;
}) => `${ARCHIVE_PREFIX}/${path}/${archiveStamp(at)}${extensionOf(path)}`;

/** An object that is not there yet is a normal outcome, not a transport failure. */
export const isNotFound = (
  error: { message?: string; status?: number } | null,
) =>
  !!error && (error.status === 404 || /not.?found/i.test(error.message ?? ''));

type StorageEntry = { id: string | null; name: string };

// Storage's `list` defaults to 100 rows and reports no truncation, so a folder
// with more objects would silently list short. These trees are far smaller than
// this, but the limit is stated rather than inherited.
const LIST_LIMIT = 1000;

const listEntries = async ({
  client,
  bucket,
  prefix,
  search,
}: {
  client: DataClient;
  bucket: string;
  prefix: string;
  search?: string;
}) => {
  const { data, error } = await client.storage
    .from(bucket)
    .list(prefix, { limit: LIST_LIMIT, ...(search ? { search } : {}) });

  if (error) {
    return { entries: undefined, error: error.message };
  }

  return { entries: (data ?? []) as StorageEntry[], error: undefined };
};

/**
 * Lists object paths under a prefix, descending into pseudo-folders — storage
 * marks those with a null `id`. `maxDepth` counts listing calls, so 1 is a flat
 * listing of the prefix itself and 2 also covers its immediate folders.
 *
 * Returns `undefined` on failure rather than an empty list: a caller must not
 * read a denied listing as "nothing is there".
 */
export const listObjects = async ({
  client,
  bucket,
  prefix = '',
  skip = [],
  maxDepth = 2,
}: {
  client: DataClient;
  bucket: string;
  prefix?: string;
  skip?: string[];
  maxDepth?: number;
}): Promise<string[] | undefined> => {
  const paths: string[] = [];

  const descend = async (at: string, depth: number): Promise<boolean> => {
    const { entries, error } = await listEntries({
      client,
      bucket,
      prefix: at,
    });
    if (!entries) {
      console.error(`Error listing ${bucket}/${at}:`, error);
      return false;
    }

    for (const entry of entries) {
      const path = at ? `${at}/${entry.name}` : entry.name;
      if (skip.includes(path)) continue;

      if (entry.id) {
        paths.push(path);
        continue;
      }

      if (depth >= maxDepth) continue;
      if (!(await descend(path, depth + 1))) return false;
    }

    return true;
  };

  return (await descend(prefix, 1)) ? paths.sort() : undefined;
};

/**
 * Whether a live object is present, via a filtered listing rather than a HEAD.
 * `list` reports a refusal as an error, where `exists()` collapses "absent" and
 * "not permitted" into the same `false` — and a false negative here would skip
 * the archive and let an upsert overwrite a revision unrecoverably.
 *
 * `search` matches by prefix, so the result is checked for the exact name.
 */
export const objectExists = async ({
  client,
  bucket,
  path,
}: {
  client: DataClient;
  bucket: string;
  path: string;
}): Promise<{ exists: boolean; error?: string }> => {
  const cut = path.lastIndexOf('/');
  const prefix = cut === -1 ? '' : path.slice(0, cut);
  const name = path.slice(cut + 1);

  const { entries, error } = await listEntries({
    client,
    bucket,
    prefix,
    search: name,
  });

  if (!entries) {
    return { exists: false, error };
  }

  return { exists: entries.some((e) => e.id && e.name === name) };
};

/**
 * Copies the current revision of `path` into the archive. A caller that is
 * about to replace the object must abandon the write when this fails — the copy
 * is what makes the replacement recoverable.
 */
export const archiveObject = async ({
  client,
  bucket,
  path,
  at = new Date(),
}: {
  client: DataClient;
  bucket: string;
  path: string;
  at?: Date;
}) => {
  const to = archivedObjectPath({ path, at });

  const { error } = await client.storage.from(bucket).copy(path, to);
  if (error) {
    return { archived: false, path: undefined, error: error.message };
  }

  return { archived: true, path: to, error: undefined };
};

/**
 * Archives the live object at `path` when one is present, so the caller can
 * replace it. Reports the archived key, or `undefined` when there was nothing
 * to archive; a failed listing is treated as a failure, not as absence.
 */
export const archiveIfPresent = async ({
  client,
  bucket,
  path,
  at = new Date(),
}: {
  client: DataClient;
  bucket: string;
  path: string;
  at?: Date;
}): Promise<{ archivedPath?: string; error?: string }> => {
  const present = await objectExists({ client, bucket, path });
  if (present.error) {
    return {
      error: `Could not check whether ${path} exists (${present.error})`,
    };
  }
  if (!present.exists) {
    return {};
  }

  const archive = await archiveObject({ client, bucket, path, at });
  if (!archive.archived) {
    return {
      error: `Could not archive the current ${path} before writing (${archive.error})`,
    };
  }

  return { archivedPath: archive.path };
};

/** Uploads text, replacing whatever is at `path`. Archiving is the caller's job. */
export const uploadText = async ({
  client,
  bucket,
  path,
  content,
}: {
  client: DataClient;
  bucket: string;
  path: string;
  content: string;
}) => {
  const contentType = contentTypeFor(path);

  const { error } = await client.storage
    .from(bucket)
    .upload(path, new Blob([content], { type: contentType }), {
      upsert: true,
      contentType,
    });

  return { written: !error, error: error?.message };
};
