import { DataClient } from './types';

/**
 * Bucket holding the translation policies as markdown. Access is enforced by
 * RLS, not here — nothing in this module can widen it.
 */
export const HARNESS_BUCKET = 'translation-harness';

/** Append-only prefix holding prior revisions; RLS denies UPDATE and DELETE on it. */
export const HARNESS_ARCHIVE_PREFIX = 'archive';

const POLICY_SUFFIX = '.md';

/**
 * A policy name is its object key without the `.md`. The tree is one level deep
 * so the name also says which governing document the section came from — the
 * two source documents number their sections independently.
 */
export const policyPath = (name: string) =>
  name.endsWith(POLICY_SUFFIX) ? name : `${name}${POLICY_SUFFIX}`;

export const policyName = (path: string) =>
  path.endsWith(POLICY_SUFFIX)
    ? path.slice(0, -POLICY_SUFFIX.length)
    : path;

/** `20260908T193000Z` — sorts chronologically, needs no escaping in a key. */
export const archiveStamp = (at: Date = new Date()) =>
  at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

export const archivePathFor = (name: string, at: Date = new Date()) =>
  `${HARNESS_ARCHIVE_PREFIX}/${policyPath(name)}/${archiveStamp(at)}${POLICY_SUFFIX}`;

/**
 * Lists the live policy names. Storage marks pseudo-folders with a null `id`,
 * so this descends one level and skips the archive.
 */
export const listPolicies = async ({ client }: { client: DataClient }) => {
  const bucket = client.storage.from(HARNESS_BUCKET);

  const { data: roots, error } = await bucket.list('');
  if (error) {
    console.error('Error listing policies:', error.message);
    return undefined;
  }

  const names: string[] = [];
  for (const entry of roots ?? []) {
    if (entry.name === HARNESS_ARCHIVE_PREFIX) continue;

    if (entry.id) {
      if (entry.name.endsWith(POLICY_SUFFIX)) names.push(policyName(entry.name));
      continue;
    }

    const { data: children, error: childError } = await bucket.list(entry.name);
    if (childError) {
      console.error(
        `Error listing policies under ${entry.name}:`,
        childError.message,
      );
      return undefined;
    }

    for (const child of children ?? []) {
      if (!child.id || !child.name.endsWith(POLICY_SUFFIX)) continue;
      names.push(policyName(`${entry.name}/${child.name}`));
    }
  }

  return names.sort();
};

export type Policy = { name: string; content: string };

/** A policy that is not there yet is a normal outcome, not a transport failure. */
const isNotFound = (error: { message?: string; status?: number } | null) =>
  !!error &&
  (error.status === 404 || /not.?found/i.test(error.message ?? ''));

export const readPolicy = async ({
  client,
  name,
}: {
  client: DataClient;
  name: string;
}): Promise<Policy | undefined> => {
  const { data, error } = await client.storage
    .from(HARNESS_BUCKET)
    .download(policyPath(name));

  if (error || !data) {
    // Absence is reported by the caller — `readPolicies` as `missing`, and
    // `writePolicy` as the difference between creating and replacing. Only a
    // real failure is worth a log line.
    if (!isNotFound(error)) {
      console.error(`Error reading policy ${name}:`, error?.message);
    }
    return undefined;
  }

  return { name: policyName(name), content: await data.text() };
};

/** Resolves each name independently, reporting the ones that did not resolve. */
export const readPolicies = async ({
  client,
  names,
}: {
  client: DataClient;
  names: string[];
}) => {
  const results = await Promise.all(
    names.map((name) => readPolicy({ client, name })),
  );

  const policies = results.filter((p): p is Policy => !!p);
  const missing = names.filter((_, i) => !results[i]);
  return { policies, missing };
};

/** Copies the current revision into the archive. */
export const archivePolicy = async ({
  client,
  name,
  at = new Date(),
}: {
  client: DataClient;
  name: string;
  at?: Date;
}) => {
  const from = policyPath(name);
  const to = archivePathFor(name, at);

  const { error } = await client.storage.from(HARNESS_BUCKET).copy(from, to);
  if (error) {
    return { archived: false, path: undefined, error: error.message };
  }

  return { archived: true, path: to, error: undefined };
};

/**
 * Archive-on-write. A failed archive stops the write: the copy is what makes an
 * edit recoverable, so losing it silently would defeat the point.
 */
export const writePolicy = async ({
  client,
  name,
  content,
  at = new Date(),
}: {
  client: DataClient;
  name: string;
  content: string;
  at?: Date;
}) => {
  const path = policyPath(name);
  const existing = await readPolicy({ client, name });

  let archivedPath: string | undefined;
  if (existing) {
    const archive = await archivePolicy({ client, name, at });
    if (!archive.archived) {
      return {
        written: false,
        archivedPath: undefined,
        error: `Could not archive the current ${policyName(name)} before writing (${archive.error}); the write was not attempted.`,
      };
    }
    archivedPath = archive.path;
  }

  const { error } = await client.storage
    .from(HARNESS_BUCKET)
    .upload(path, new Blob([content], { type: 'text/markdown' }), {
      upsert: true,
      contentType: 'text/markdown',
    });

  if (error) {
    return { written: false, archivedPath, error: error.message };
  }

  return { written: true, archivedPath, created: !existing, error: undefined };
};
