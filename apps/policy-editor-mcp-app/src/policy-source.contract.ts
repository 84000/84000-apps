/**
 * Mirror of the `PolicySource` contract that DEV-810 owns, copied verbatim.
 * Do not change it here. In DEV-811 phase 2, delete this file and import the
 * same names from `@eightyfourthousand/lib-editing/policy-editor`.
 */

/** Opaque version token: hex SHA-256 of the UTF-8 policy content. */
export type PolicyVersion = string;

export type PolicyPermissions = {
  read: boolean;
  edit: boolean;
  admin: boolean;
};

export type PolicyDocument = {
  name: string;
  content: string;
  version: PolicyVersion;
};

/** One archived revision. `path` is the archive object key; `archivedAt` is ISO-8601 parsed from the archive stamp. */
export type PolicyRevision = { name: string; path: string; archivedAt: string };

export type PolicyFailure =
  | { ok: false; reason: 'conflict'; current: PolicyDocument } // expectedVersion mismatch
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'exists' } // rename target already exists
  | { ok: false; reason: 'forbidden' }
  | { ok: false; reason: 'error'; message: string };

export type PolicyWriteResult =
  | {
      ok: true;
      version: PolicyVersion;
      created: boolean;
      archivedPath?: string;
    }
  | PolicyFailure;

export interface PolicySource {
  list(): Promise<string[]>;
  read(name: string): Promise<PolicyDocument | undefined>;
  write(i: {
    name: string;
    content: string;
    expectedVersion?: PolicyVersion;
  }): Promise<PolicyWriteResult>;
  history(name: string): Promise<PolicyRevision[]>; // newest first
  readRevision(
    path: string,
  ): Promise<{ revision: PolicyRevision; content: string } | undefined>;
  restore(i: {
    name: string;
    revisionPath: string;
    expectedVersion?: PolicyVersion;
  }): Promise<PolicyWriteResult>; // a new write; archive untouched
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
