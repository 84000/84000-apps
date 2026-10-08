/**
 * The contract between the policy editor and whatever stores policies. Editor
 * components never fetch: they call a {@link PolicySource}, which the MCP App
 * implements over tool calls and a web page may implement over its own API.
 *
 * The policy server and the MCP App share these types: change a name, field
 * or meaning only together with them.
 */

/** Opaque version token: hex SHA-256 of the UTF-8 policy content. */
export type PolicyVersion = string;

/** What the viewer may do. Passed in by the host, never fetched. */
export type PolicyPermissions = {
  read: boolean;
  edit: boolean;
  admin: boolean;
};

/** A policy as currently stored. */
export type PolicyDocument = {
  name: string;
  content: string;
  version: PolicyVersion;
};

/** One archived revision. `path` is the archive object key; `archivedAt` is ISO-8601 parsed from the archive stamp. */
export type PolicyRevision = { name: string; path: string; archivedAt: string };

/** Why an operation was refused. */
export type PolicyFailure =
  | { ok: false; reason: 'conflict'; current: PolicyDocument } // expectedVersion mismatch
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'exists' } // rename target already exists
  | { ok: false; reason: 'forbidden' }
  | { ok: false; reason: 'error'; message: string };

/** The result of a write or restore. */
export type PolicyWriteResult =
  | {
      ok: true;
      version: PolicyVersion;
      created: boolean;
      archivedPath?: string;
    }
  | PolicyFailure;

/**
 * Policy storage as the editor sees it. Every write that names an
 * `expectedVersion` is refused with `conflict` when the stored policy has a
 * different version.
 */
export interface PolicySource {
  list(): Promise<string[]>;
  read(name: string): Promise<PolicyDocument | undefined>;
  write(i: {
    name: string;
    content: string;
    expectedVersion?: PolicyVersion;
  }): Promise<PolicyWriteResult>;
  /** Newest first. */
  history(name: string): Promise<PolicyRevision[]>;
  readRevision(
    path: string,
  ): Promise<{ revision: PolicyRevision; content: string } | undefined>;
  /** A new write of the revision's content; the archive is untouched. */
  restore(i: {
    name: string;
    revisionPath: string;
    expectedVersion?: PolicyVersion;
  }): Promise<PolicyWriteResult>;
  delete(i: {
    name: string;
    expectedVersion?: PolicyVersion;
  }): Promise<{ ok: true; archivedPath: string } | PolicyFailure>;
  rename(i: {
    from: string;
    to: string;
    expectedVersion?: PolicyVersion;
  }): Promise<{ ok: true; archivedPath: string } | PolicyFailure>;
}

/**
 * The version token for `content`: hex SHA-256 of its UTF-8 bytes, as the
 * server computes it. Uses `globalThis.crypto.subtle`, so it runs in Node and
 * in browsers, but only in a secure context (HTTPS or localhost); elsewhere it
 * throws.
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
