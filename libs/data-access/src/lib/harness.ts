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

/**
 * Opaque version token: lowercase hex SHA-256 of the UTF-8 policy content. A
 * content hash rather than storage's `updated_at`, so every surface computes
 * the same token from the text it already downloaded.
 */
export type PolicyVersion = string;

/** A live policy as read, with the version a later write can be checked against. */
export type PolicyDocument = {
  name: string;
  content: string;
  version: PolicyVersion;
};

/** @deprecated Use {@link PolicyDocument}; kept so existing imports compile. */
export type Policy = PolicyDocument;

/**
 * One archived revision. `path` is the archive object key; `archivedAt` is the
 * ISO-8601 time parsed from the archive stamp.
 */
export type PolicyRevision = { name: string; path: string; archivedAt: string };

/** Why a policy change did not happen. Nothing was changed in any of these cases. */
export type PolicyFailure =
  | { ok: false; reason: 'conflict'; current: PolicyDocument }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'exists' }
  | { ok: false; reason: 'forbidden' }
  | { ok: false; reason: 'error'; message: string };

/** Outcome of `writePolicy` and `restorePolicy`. */
export type PolicyWriteResult =
  | {
      ok: true;
      version: PolicyVersion;
      created: boolean;
      archivedPath?: string;
    }
  | PolicyFailure;

const NOT_FOUND = { ok: false, reason: 'not-found' } as const;
const FORBIDDEN = { ok: false, reason: 'forbidden' } as const;
const failed = (message: string) =>
  ({ ok: false, reason: 'error', message }) as const;

/**
 * The version of a policy's content. Web Crypto rather than `node:crypto`,
 * because this module also runs in the browser.
 */
export const policyVersion = async (
  content: string,
): Promise<PolicyVersion> => {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};

const downloadText = async ({
  client,
  path,
}: {
  client: DataClient;
  path: string;
}): Promise<
  | { content: string; error?: undefined }
  | { content?: undefined; error: { message?: string; status?: number } | null }
> => {
  const { data, error } = await client.storage
    .from(HARNESS_BUCKET)
    .download(path);
  if (error || !data) return { error };
  return { content: await data.text() };
};

export const readPolicy = async ({
  client,
  name,
}: {
  client: DataClient;
  name: string;
}): Promise<PolicyDocument | undefined> => {
  const { content, error } = await downloadText({
    client,
    path: policyPath(name),
  });

  if (content === undefined) {
    // Absence is reported by the caller — `readPolicies` as `missing`, and
    // `writePolicy` as the difference between creating and replacing. Only a
    // real failure is worth a log line.
    if (!isNotFound(error)) {
      console.error(`Error reading policy ${name}:`, error?.message);
    }
    return undefined;
  }

  return {
    name: policyName(name),
    content,
    version: await policyVersion(content),
  };
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

  const policies = results.filter((p): p is PolicyDocument => !!p);
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
 * Whether the live object at `path` is present and, when `expectedVersion` is
 * given, still the revision the caller read. A failed existence check fails
 * closed: treating it as absence would skip the archive.
 */
const checkLive = async ({
  client,
  path,
  expectedVersion,
  action,
}: {
  client: DataClient;
  path: string;
  expectedVersion?: PolicyVersion;
  action: string;
}): Promise<{ exists: boolean; failure?: PolicyFailure }> => {
  const name = policyName(path);
  const present = await objectExists({ client, bucket: HARNESS_BUCKET, path });
  if (present.error) {
    return {
      exists: false,
      failure: failed(
        `Could not check whether ${name} exists (${present.error}); the ${action} was not attempted.`,
      ),
    };
  }

  if (expectedVersion === undefined) return { exists: present.exists };

  // The conflict shape needs a current document, so a revision that has gone
  // since the caller read it is reported as absent rather than as a conflict.
  if (!present.exists) return { exists: false, failure: NOT_FOUND };

  const { content, error } = await downloadText({ client, path });
  if (content === undefined) {
    return {
      exists: true,
      failure: failed(
        `Could not read the current ${name} to check its version (${error?.message ?? 'no content'}); the ${action} was not attempted.`,
      ),
    };
  }

  const version = await policyVersion(content);
  if (version !== expectedVersion) {
    return {
      exists: true,
      failure: {
        ok: false,
        reason: 'conflict',
        current: { name, content, version },
      },
    };
  }

  return { exists: true };
};

/**
 * Archive-on-write. A failed archive stops the write: the copy is what makes an
 * edit recoverable, so losing it silently would defeat the point.
 *
 * With `expectedVersion` the write only goes ahead while the live content still
 * hashes to it; otherwise the result is a `conflict` carrying the current
 * document, and nothing is archived or written.
 */
export const writePolicy = async ({
  client,
  name,
  content,
  expectedVersion,
  at = new Date(),
}: {
  client: DataClient;
  name: string;
  content: string;
  expectedVersion?: PolicyVersion;
  at?: Date;
}): Promise<PolicyWriteResult> => {
  const path = policyPath(name);

  const live = await checkLive({
    client,
    path,
    expectedVersion,
    action: 'write',
  });
  if (live.failure) return live.failure;

  // Race window: storage has no conditional write, so the version check above
  // and the upload below are separate requests, and a write landing between
  // them is overwritten without a conflict. That is accepted at the rate
  // policies are edited; the archive is the backstop. Our archive step copies
  // whatever is live when it runs, so an intervening revision that landed
  // before it is archived by us. Only one landing in the instant between our
  // archive copy and our upload is lost, and its predecessor is still archived.
  let archivedPath: string | undefined;
  if (live.exists) {
    const archive = await archivePolicy({ client, name, at });
    if (!archive.path) {
      return archive.forbidden
        ? FORBIDDEN
        : failed(
            `Could not archive the current ${policyName(name)} before writing (${archive.error}); the write was not attempted.`,
          );
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
    return upload.forbidden
      ? FORBIDDEN
      : failed(upload.error ?? `Could not write ${policyName(name)}.`);
  }

  return {
    ok: true,
    version: await policyVersion(content),
    created: !live.exists,
    archivedPath,
  };
};
