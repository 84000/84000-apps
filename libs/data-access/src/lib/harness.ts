import { DataClient } from './types';
import {
  ARCHIVE_PREFIX,
  archiveObject,
  archiveStamp,
  archivedObjectPath,
  isNotFound,
  listObjects,
  objectExists,
  uploadText,
} from './storage-archive';

/**
 * Bucket holding the translation policies as markdown. Access is enforced by
 * RLS, not here — nothing in this module can widen it.
 */
export const HARNESS_BUCKET = 'translation-harness';

/** Append-only prefix holding prior revisions; RLS denies UPDATE and DELETE on it. */
export const HARNESS_ARCHIVE_PREFIX = ARCHIVE_PREFIX;

const POLICY_SUFFIX = '.md';

/**
 * A policy name is its object key without the `.md`. The tree is one level deep
 * so the name also says which governing document the section came from — the
 * two source documents number their sections independently.
 */
export const policyPath = (name: string) =>
  name.endsWith(POLICY_SUFFIX) ? name : `${name}${POLICY_SUFFIX}`;

export const policyName = (path: string) =>
  path.endsWith(POLICY_SUFFIX) ? path.slice(0, -POLICY_SUFFIX.length) : path;

export { archiveStamp };

export const archivePathFor = (name: string, at: Date = new Date()) =>
  archivedObjectPath({ path: policyPath(name), at });

/** Lists the live policy names, skipping the archive. */
export const listPolicies = async ({ client }: { client: DataClient }) => {
  const paths = await listObjects({
    client,
    bucket: HARNESS_BUCKET,
    skip: [HARNESS_ARCHIVE_PREFIX],
  });

  if (!paths) return undefined;

  return paths
    .filter((path) => path.endsWith(POLICY_SUFFIX))
    .map(policyName)
    .sort();
};

export type Policy = { name: string; content: string };

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
}) =>
  archiveObject({
    client,
    bucket: HARNESS_BUCKET,
    path: policyPath(name),
    at,
  });

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

  const present = await objectExists({
    client,
    bucket: HARNESS_BUCKET,
    path,
  });
  if (present.error) {
    return {
      written: false,
      archivedPath: undefined,
      error: `Could not check whether ${policyName(name)} exists (${present.error}); the write was not attempted.`,
    };
  }

  let archivedPath: string | undefined;
  if (present.exists) {
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

  const upload = await uploadText({
    client,
    bucket: HARNESS_BUCKET,
    path,
    content,
  });

  if (!upload.written) {
    return { written: false, archivedPath, error: upload.error };
  }

  return {
    written: true,
    archivedPath,
    created: !present.exists,
    error: undefined,
  };
};
