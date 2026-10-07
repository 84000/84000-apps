import {
  policyVersion,
  type PolicyDocument,
  type PolicyFailure,
  type PolicyRevision,
  type PolicySource,
  type PolicyVersion,
} from './policy-source';

/**
 * An in-memory {@link PolicySource}, for tests and stories. It refuses a
 * stale `expectedVersion` with `conflict`, archives the replaced content on
 * every write, restore, delete and rename, and lists history newest first.
 * Changes run one at a time, so each checks its version against the last.
 */
export const createMemoryPolicySource = (
  initial: Record<string, string> = {},
): PolicySource => {
  const policies = new Map(Object.entries(initial));
  const archive = new Map<
    string,
    { revision: PolicyRevision; content: string }
  >();
  let lastStamp = 0;
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs `change` after every change before it has settled. */
  const serial =
    <A extends unknown[], R>(change: (...args: A) => Promise<R>) =>
    (...args: A): Promise<R> => {
      const run = queue.then(() => change(...args));
      queue = run.catch(() => undefined);
      return run;
    };

  const read = async (name: string): Promise<PolicyDocument | undefined> => {
    const content = policies.get(name);
    return content === undefined
      ? undefined
      : { name, content, version: await policyVersion(content) };
  };

  /** Archives the current content of `name`, returning its archive key. */
  const archiveCurrent = (name: string, content: string) => {
    // Strictly increasing, so history order never depends on clock resolution.
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    const archivedAt = new Date(lastStamp).toISOString();
    const path = `archive/${name}/${archivedAt}.md`;
    archive.set(path, { revision: { name, path, archivedAt }, content });
    return path;
  };

  /** Refuses the operation when `expectedVersion` is stale. */
  const check = async (
    name: string,
    expectedVersion: PolicyVersion | undefined,
  ): Promise<PolicyFailure | undefined> => {
    if (expectedVersion === undefined) {
      return undefined;
    }
    const current = await read(name);
    if (!current) {
      return { ok: false, reason: 'not-found' };
    }
    return current.version === expectedVersion
      ? undefined
      : { ok: false, reason: 'conflict', current };
  };

  const write: PolicySource['write'] = async ({
    name,
    content,
    expectedVersion,
  }) => {
    const failure = await check(name, expectedVersion);
    if (failure) {
      return failure;
    }
    const previous = policies.get(name);
    const archivedPath =
      previous === undefined ? undefined : archiveCurrent(name, previous);
    policies.set(name, content);
    return {
      ok: true,
      version: await policyVersion(content),
      created: previous === undefined,
      ...(archivedPath && { archivedPath }),
    };
  };

  return {
    list: async () => [...policies.keys()].sort(),
    read,
    write: serial(write),
    history: async (name) =>
      [...archive.values()]
        .map(({ revision }) => revision)
        .filter((revision) => revision.name === name)
        .reverse(),
    readRevision: async (path) => archive.get(path),
    // Like the server, restores a revision of any policy, not only of `name`.
    restore: serial(async ({ name, revisionPath, expectedVersion }) => {
      const revision = archive.get(revisionPath);
      return revision
        ? write({ name, content: revision.content, expectedVersion })
        : { ok: false, reason: 'not-found' };
    }),
    delete: serial(async ({ name, expectedVersion }) => {
      const content = policies.get(name);
      if (content === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      const failure = await check(name, expectedVersion);
      if (failure) {
        return failure;
      }
      policies.delete(name);
      return { ok: true, archivedPath: archiveCurrent(name, content) };
    }),
    rename: serial(async ({ from, to, expectedVersion }) => {
      const content = policies.get(from);
      if (content === undefined) {
        return { ok: false, reason: 'not-found' };
      }
      if (policies.has(to)) {
        return { ok: false, reason: 'exists' };
      }
      const failure = await check(from, expectedVersion);
      if (failure) {
        return failure;
      }
      policies.delete(from);
      policies.set(to, content);
      return { ok: true, archivedPath: archiveCurrent(from, content) };
    }),
  };
};
