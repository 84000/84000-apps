import type {
  PolicyDocument,
  PolicyFailure,
  PolicyRevision,
  PolicySource,
  PolicyVersion,
  PolicyWriteResult,
} from './policy-source.contract';
import { POLICY_TOOL_NAMES } from './tool-names';
import { isRecord, parseToolResult, type ToolCaller } from './tool-result';

/**
 * Thrown by the reading methods (`list`, `read`, `history`, `readRevision`)
 * when the server refused or the call failed. A failed listing is never an
 * empty list. A transport or parse failure is never "not found", though the
 * server may itself report a storage error as `not-found`.
 */
export class PolicySourceError extends Error {
  constructor(readonly failure: PolicyFailure) {
    super(
      failure.reason === 'error'
        ? failure.message
        : `The request failed: ${failure.reason}.`,
    );
    this.name = 'PolicySourceError';
  }
}

type Outcome =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; failure: PolicyFailure };

const failed = (message: string): { ok: false; failure: PolicyFailure } => ({
  ok: false,
  failure: { ok: false, reason: 'error', message },
});

const isString = (value: unknown): value is string => typeof value === 'string';

const excerpt = (text: string) =>
  text.length > 200 ? `${text.slice(0, 200)}…` : text;

const toDocument = (value: unknown): PolicyDocument | undefined =>
  isRecord(value) &&
  isString(value.name) &&
  isString(value.content) &&
  isString(value.version)
    ? { name: value.name, content: value.content, version: value.version }
    : undefined;

const toRevision = (value: unknown): PolicyRevision | undefined =>
  isRecord(value) &&
  isString(value.name) &&
  isString(value.path) &&
  isString(value.archivedAt)
    ? { name: value.name, path: value.path, archivedAt: value.archivedAt }
    : undefined;

/** The contract shape of a failure body; extra fields such as `message` are dropped. */
const toFailure = (
  body: Record<string, unknown>,
): PolicyFailure | undefined => {
  if (body.ok !== false) return undefined;
  switch (body.reason) {
    case 'conflict': {
      const current = toDocument(body.current);
      return current ? { ok: false, reason: 'conflict', current } : undefined;
    }
    case 'not-found':
    case 'exists':
    case 'forbidden':
      return { ok: false, reason: body.reason };
    case 'error':
      return {
        ok: false,
        reason: 'error',
        message: isString(body.message)
          ? body.message
          : 'The server reported an error.',
      };
    default:
      return undefined;
  }
};

const toWriteSuccess = (
  body: Record<string, unknown>,
): PolicyWriteResult | undefined => {
  if (body.ok !== true || !isString(body.version)) return undefined;
  if (typeof body.created !== 'boolean') return undefined;
  if (body.archivedPath !== undefined && !isString(body.archivedPath)) {
    return undefined;
  }
  return {
    ok: true,
    version: body.version,
    created: body.created,
    ...(body.archivedPath === undefined
      ? {}
      : { archivedPath: body.archivedPath }),
  };
};

const toArchived = (
  body: Record<string, unknown>,
): { ok: true; archivedPath: string } | undefined =>
  body.ok === true && isString(body.archivedPath)
    ? { ok: true, archivedPath: body.archivedPath }
    : undefined;

const NOT_FOUND = Symbol('not-found');
type NotFound = typeof NOT_FOUND;

const orUndefined = <T>(value: T | NotFound): T | undefined =>
  value === NOT_FOUND ? undefined : value;

const orThrow = <T>(value: T | NotFound): T => {
  if (value === NOT_FOUND) {
    throw new PolicySourceError({ ok: false, reason: 'not-found' });
  }
  return value;
};

/** The server returns names without one trailing `.md`. */
const sameName = (a: string, b: string) =>
  a.replace(/\.md$/, '') === b.replace(/\.md$/, '');

const withVersion = (expectedVersion: PolicyVersion | undefined) =>
  expectedVersion === undefined ? {} : { expectedVersion };

/**
 * A {@link PolicySource} over the studio MCP server's policy tools, called
 * through the host bridge. Results are read from the tool result's `content`
 * text only.
 *
 * Mutating methods never throw: a failed call or an unreadable result comes
 * back as `{ ok: false, reason: 'error' }`. Reading methods throw a
 * {@link PolicySourceError} instead, except that `read` and `readRevision`
 * return `undefined` for `not-found`.
 */
export function createMcpPolicySource(caller: ToolCaller): PolicySource {
  const call = async (
    tool: string,
    args: Record<string, unknown>,
  ): Promise<Outcome> => {
    let result: unknown;
    try {
      result = await caller.callServerTool({ name: tool, arguments: args });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return failed(`Could not call ${tool}: ${reason}`);
    }

    const parsed = parseToolResult(result);
    if (!parsed.ok) {
      return failed(
        parsed.text
          ? `${tool} returned an unreadable result: ${excerpt(parsed.text)}`
          : `${tool} returned an unreadable result.`,
      );
    }
    const failure = toFailure(parsed.body);
    if (failure) return { ok: false, failure };
    if (parsed.isError || parsed.body.ok === false) {
      return failed(`${tool} returned an unrecognised error.`);
    }
    return { ok: true, body: parsed.body };
  };

  /** Runs a mutating tool; every failure comes back as a value. */
  const mutate = async <T>(
    tool: string,
    args: Record<string, unknown>,
    decode: (body: Record<string, unknown>) => T | undefined,
  ): Promise<T | PolicyFailure> => {
    const outcome = await call(tool, args);
    if (!outcome.ok) return outcome.failure;
    return (
      decode(outcome.body) ??
      failed(`${tool} returned an unexpected result.`).failure
    );
  };

  /**
   * Runs a reading tool. Throws on any failure except `not-found`, which comes
   * back as {@link NOT_FOUND} for the caller to map.
   */
  const query = async <T>(
    tool: string,
    args: Record<string, unknown>,
    decode: (body: Record<string, unknown>) => T | NotFound | undefined,
  ): Promise<T | NotFound> => {
    const outcome = await call(tool, args);
    if (!outcome.ok) {
      if (outcome.failure.reason === 'not-found') return NOT_FOUND;
      throw new PolicySourceError(outcome.failure);
    }
    const value = decode(outcome.body);
    if (value === undefined) {
      throw new PolicySourceError(
        failed(`${tool} returned an unexpected result.`).failure,
      );
    }
    return value;
  };

  return {
    list: async () =>
      orThrow(
        await query(POLICY_TOOL_NAMES.read, {}, (body) =>
          Array.isArray(body.policies) && body.policies.every(isString)
            ? [...body.policies]
            : undefined,
        ),
      ),

    read: async (name) =>
      orUndefined(
        await query(POLICY_TOOL_NAMES.read, { names: [name] }, (body) => {
          if (!Array.isArray(body.policies)) return undefined;
          const match = body.policies.find(
            (policy) =>
              isRecord(policy) &&
              isString(policy.name) &&
              sameName(policy.name, name),
          );
          return match === undefined ? NOT_FOUND : toDocument(match);
        }),
      ),

    /**
     * The editor always passes `expectedVersion` for an existing policy, so a
     * concurrent edit comes back as `conflict` rather than being overwritten.
     */
    write: ({ name, content, expectedVersion }) =>
      mutate(
        POLICY_TOOL_NAMES.write,
        { name, content, ...withVersion(expectedVersion) },
        toWriteSuccess,
      ),

    history: async (name) =>
      orThrow(
        await query(POLICY_TOOL_NAMES.history, { name }, (body) => {
          if (!Array.isArray(body.revisions)) return undefined;
          // Server order: archive path descending, which is newest first.
          const revisions = body.revisions.map(toRevision);
          return revisions.every(
            (revision): revision is PolicyRevision => revision !== undefined,
          )
            ? revisions
            : undefined;
        }),
      ),

    readRevision: async (path) =>
      orUndefined(
        await query(POLICY_TOOL_NAMES.readRevision, { path }, (body) => {
          const revision = toRevision(body.revision);
          return revision && isString(body.content)
            ? { revision, content: body.content }
            : undefined;
        }),
      ),

    restore: ({ name, revisionPath, expectedVersion }) =>
      mutate(
        POLICY_TOOL_NAMES.restore,
        { name, revisionPath, ...withVersion(expectedVersion) },
        toWriteSuccess,
      ),

    delete: ({ name, expectedVersion }) =>
      mutate(
        POLICY_TOOL_NAMES.delete,
        { name, ...withVersion(expectedVersion) },
        toArchived,
      ),

    rename: ({ from, to, expectedVersion }) =>
      mutate(
        POLICY_TOOL_NAMES.rename,
        { from, to, ...withVersion(expectedVersion) },
        toArchived,
      ),
  };
}
