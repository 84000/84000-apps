import { hasPermission } from './auth';
import { DataClient } from './types';
import {
  ARCHIVE_PREFIX,
  archiveObject,
  archiveStamp,
  archivedObjectPath,
  isAlreadyExists,
  isForbidden,
  isNotFound,
  listObjects,
  objectExists,
  removeObjects,
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

/**
 * One segment of a policy key: a leading letter or digit, then letters,
 * digits, `.`, `_` or `-`. An allowlist rather than a denylist because storage
 * puts the key into the URL path for upload and download but sends it as JSON
 * for list, copy and remove — URL normalisation turns `\` into `/`, resolves
 * `..`, decodes `%2e` and cuts at `?` or `#`, so anything a URL would rewrite
 * must never reach storage.
 */
const POLICY_SEGMENT = '[A-Za-z0-9][A-Za-z0-9._-]*';
const POLICY_SEGMENT_PATTERN = new RegExp(`^${POLICY_SEGMENT}$`);

/**
 * Whether `name` is a writable policy name: exactly `<dir>/<file>` once one
 * `.md` is stripped, each segment matching the allowlist, no second `.md`, and
 * never under the archive. Checked before any storage call, so a bad name
 * cannot reach the archive prefix or a deeper key that the history and
 * revision readers would not recognise.
 */
export const isValidPolicyName = (name: string) => {
  const stripped = policyName(name);
  if (stripped.endsWith(POLICY_SUFFIX)) return false;
  const segments = stripped.split('/');
  return (
    segments.length === 2 &&
    segments.every((s) => POLICY_SEGMENT_PATTERN.test(s)) &&
    segments[0] !== HARNESS_ARCHIVE_PREFIX
  );
};

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
const EXISTS = { ok: false, reason: 'exists' } as const;
const FORBIDDEN = { ok: false, reason: 'forbidden' } as const;
const failed = (message: string) =>
  ({ ok: false, reason: 'error', message }) as const;
const invalidName = (name: string) =>
  failed(`${name} is not a valid policy name`);

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
  // An invalid name cannot name a policy, so it is reported as missing
  // without a storage call that URL normalisation could redirect.
  if (!isValidPolicyName(name)) return undefined;
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
 *
 * The listing only distinguishes "absent" from "hidden" because every role
 * holding harness.edit or harness.admin also holds harness.read; a role that
 * could write without reading would see every policy as absent.
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
  if (!isValidPolicyName(name)) return invalidName(name);
  const path = policyPath(name);

  const live = await checkLive({
    client,
    path,
    expectedVersion,
    action: 'write',
  });
  if (live.failure) return live.failure;

  // Race window. Creating is closed: the upload below does not upsert when
  // nothing was live, so a concurrent create makes it fail and is reported as
  // a conflict. Replacing is not: storage has no conditional overwrite, so the
  // version check above and the upload are separate requests, and a write
  // landing between them is overwritten without a conflict. That is accepted
  // at the rate policies are edited; the archive is the backstop. Our archive
  // step copies whatever is live when it runs, so an intervening revision that
  // landed before it is archived by us. Only one landing in the instant
  // between our archive copy and our upload is lost, and its predecessor is
  // still archived.
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
    upsert: live.exists,
  });

  if (!upload.written && upload.exists && !live.exists) {
    // Someone created the policy since we looked. Hand back what they wrote
    // so the caller can compare, rather than overwriting it.
    const current = await readPolicy({ client, name });
    return current
      ? { ok: false, reason: 'conflict', current }
      : failed(
          `${policyName(name)} was created by someone else during this write, and could not be read back; nothing was written.`,
        );
  }

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

const ARCHIVE_STAMP_FILE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.md$/;

/** `20260908T193000Z.md` → `2026-09-08T19:30:00.000Z`, or `undefined` if it is not a stamp. */
const archivedAtFrom = (file: string) => {
  const match = ARCHIVE_STAMP_FILE.exec(file);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const at = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
};

/**
 * The archived revisions of a policy, newest first. Returns `undefined` when
 * the listing fails, so a denied listing is never read as "no history", and
 * `[]` for a policy that has none.
 */
export const listPolicyRevisions = async ({
  client,
  name,
}: {
  client: DataClient;
  name: string;
}): Promise<PolicyRevision[] | undefined> => {
  if (!isValidPolicyName(name)) return undefined;
  const prefix = `${HARNESS_ARCHIVE_PREFIX}/${policyPath(name)}`;
  const paths = await listObjects({
    client,
    bucket: HARNESS_BUCKET,
    prefix,
    maxDepth: 1,
  });
  if (!paths) return undefined;

  const revisionName = policyName(policyPath(name));
  return paths
    .flatMap((path) => {
      const archivedAt = archivedAtFrom(path.slice(prefix.length + 1));
      return archivedAt ? [{ name: revisionName, path, archivedAt }] : [];
    })
    .sort((a, b) => b.path.localeCompare(a.path));
};

// `archive/<dir>/<file>.md/<stamp>.md` — the only keys `readPolicyRevision`
// will read, so it cannot be pointed at a live object.
const REVISION_KEY = new RegExp(
  `^${HARNESS_ARCHIVE_PREFIX}/(${POLICY_SEGMENT})/(${POLICY_SEGMENT})\\.md/(\\d{8}T\\d{6}Z\\.md)$`,
);

const parseRevisionPath = (path: string): PolicyRevision | undefined => {
  const match = REVISION_KEY.exec(path);
  if (!match) return undefined;
  const [, dir, file, stamp] = match;
  // The live key this revision was archived from must itself be valid.
  if (!isValidPolicyName(`${dir}/${file}${POLICY_SUFFIX}`)) return undefined;
  const archivedAt = archivedAtFrom(stamp);
  return archivedAt ? { name: `${dir}/${file}`, path, archivedAt } : undefined;
};

/**
 * Reads one archived revision by its archive key. Returns `undefined` for a key
 * that is not an archived policy revision, for one that is not there, and for a
 * failed read (which is logged).
 */
export const readPolicyRevision = async ({
  client,
  path,
}: {
  client: DataClient;
  path: string;
}): Promise<{ revision: PolicyRevision; content: string } | undefined> => {
  const revision = parseRevisionPath(path);
  if (!revision) return undefined;

  const { content, error } = await downloadText({ client, path });
  if (content === undefined) {
    if (!isNotFound(error)) {
      console.error(`Error reading policy revision ${path}:`, error?.message);
    }
    return undefined;
  }

  return { revision, content };
};

/**
 * Restores an archived revision by writing its content as a new revision: the
 * current one is archived first, as for any write, and the archive itself is
 * never modified. The revision may come from a different policy's archive —
 * after a rename the history stays under the old name, so restoring old text
 * onto the new name has to work.
 */
export const restorePolicy = async ({
  client,
  name,
  revisionPath,
  expectedVersion,
  at = new Date(),
}: {
  client: DataClient;
  name: string;
  revisionPath: string;
  expectedVersion?: PolicyVersion;
  at?: Date;
}): Promise<PolicyWriteResult> => {
  if (!isValidPolicyName(name)) return invalidName(name);
  const revision = await readPolicyRevision({ client, path: revisionPath });
  if (!revision) return NOT_FOUND;

  return writePolicy({
    client,
    name,
    content: revision.content,
    expectedVersion,
    at,
  });
};

/**
 * Deletes a live policy after archiving it. Requires `harness.admin`, checked
 * up front: RLS would filter the delete anyway, but only after the archive copy
 * had been made. A failed archive stops the delete.
 */
export const deletePolicy = async ({
  client,
  name,
  expectedVersion,
  at = new Date(),
}: {
  client: DataClient;
  name: string;
  expectedVersion?: PolicyVersion;
  at?: Date;
}): Promise<{ ok: true; archivedPath: string } | PolicyFailure> => {
  if (!isValidPolicyName(name)) return invalidName(name);
  if (!(await hasPermission({ client, permission: 'harness.admin' }))) {
    return FORBIDDEN;
  }

  const path = policyPath(name);
  const live = await checkLive({
    client,
    path,
    expectedVersion,
    action: 'delete',
  });
  if (live.failure) return live.failure;
  if (!live.exists) return NOT_FOUND;

  // Race window, as in `writePolicy`: storage has no conditional delete, so a
  // write landing between our archive copy and our remove is deleted without
  // being archived. Its predecessor is archived, by us. Rename has the same
  // window between its archive of `from` and the remove.
  const archive = await archivePolicy({ client, name, at });
  if (!archive.path) {
    return archive.forbidden
      ? FORBIDDEN
      : failed(
          `Could not archive ${policyName(name)} before deleting it (${archive.error}); the delete was not attempted.`,
        );
  }

  const removal = await removeObjects({
    client,
    bucket: HARNESS_BUCKET,
    paths: [path],
  });
  if (!removal.removed) {
    return removal.forbidden
      ? FORBIDDEN
      : failed(
          `Archived ${policyName(name)} to ${archive.path} but could not delete it (${removal.error}).`,
        );
  }

  return { ok: true, archivedPath: archive.path };
};

/**
 * Renames a policy: copy to the new name, archive the old one, then delete it.
 * Requires `harness.admin`, checked up front so a caller who could copy but not
 * delete never leaves the rename half done. If a step after the copy fails, the
 * copy is archived and removed again (best effort) and the error says whether
 * that worked. The history stays under the old name. The race window is the
 * one described on `deletePolicy`.
 */
export const renamePolicy = async ({
  client,
  from,
  to,
  expectedVersion,
  at = new Date(),
}: {
  client: DataClient;
  from: string;
  to: string;
  expectedVersion?: PolicyVersion;
  at?: Date;
}): Promise<{ ok: true; archivedPath: string } | PolicyFailure> => {
  if (!isValidPolicyName(from)) return invalidName(from);
  if (!isValidPolicyName(to)) return invalidName(to);
  const fromPath = policyPath(from);
  const toPath = policyPath(to);
  const fromName = policyName(fromPath);
  const toName = policyName(toPath);

  if (fromPath === toPath) {
    return failed(`${fromName} cannot be renamed to itself.`);
  }

  if (!(await hasPermission({ client, permission: 'harness.admin' }))) {
    return FORBIDDEN;
  }

  const target = await objectExists({
    client,
    bucket: HARNESS_BUCKET,
    path: toPath,
  });
  if (target.error) {
    return failed(
      `Could not check whether ${toName} exists (${target.error}); the rename was not attempted.`,
    );
  }
  if (target.exists) return EXISTS;

  const live = await checkLive({
    client,
    path: fromPath,
    expectedVersion,
    action: 'rename',
  });
  if (live.failure) return live.failure;
  if (!live.exists) return NOT_FOUND;

  // Storage refuses a copy onto an existing key, so a target created since the
  // check above still cannot be overwritten.
  const { error: copyError } = await client.storage
    .from(HARNESS_BUCKET)
    .copy(fromPath, toPath);
  if (copyError) {
    if (isAlreadyExists(copyError)) return EXISTS;
    if (isForbidden(copyError)) return FORBIDDEN;
    return failed(
      `Could not copy ${fromName} to ${toName} (${copyError.message}); the rename was not attempted.`,
    );
  }

  // The copy is archived before it is removed, as any delete is, so a write
  // that landed at `to` since our copy is never lost by the rollback.
  const rollBack = async (reason: string) => {
    const kept = `${reason}; ${fromName} was left in place`;
    const saved = await archivePolicy({ client, name: toPath, at });
    if (!saved.path) {
      return failed(
        `${kept} and so was the copy at ${toName}, because it could not be archived first (${saved.error}); check it and remove it by hand.`,
      );
    }
    const undo = await removeObjects({
      client,
      bucket: HARNESS_BUCKET,
      paths: [toPath],
    });
    return failed(
      undo.removed
        ? `${kept} and the copy at ${toName} was archived and removed.`
        : `${kept} but the copy at ${toName} could not be removed (${undo.error}) and must be removed by hand.`,
    );
  };

  const archive = await archivePolicy({ client, name: fromPath, at });
  if (!archive.path) {
    return rollBack(`Could not archive ${fromName} (${archive.error})`);
  }

  const removal = await removeObjects({
    client,
    bucket: HARNESS_BUCKET,
    paths: [fromPath],
  });
  if (!removal.removed) {
    // Someone may have deleted `from` at the same moment, which makes our
    // remove come up short. If it is gone, the rename happened: keep `to`.
    // A failed re-check is treated as still there, so the copy is rolled back.
    const source = await objectExists({
      client,
      bucket: HARNESS_BUCKET,
      path: fromPath,
    });
    if (!source.error && !source.exists) {
      return { ok: true, archivedPath: archive.path };
    }
    return rollBack(
      `Archived ${fromName} to ${archive.path} but could not delete it (${removal.error})`,
    );
  }

  return { ok: true, archivedPath: archive.path };
};
