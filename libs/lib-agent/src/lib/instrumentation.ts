import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { McpToolDefinition } from './types';

/** Fired for every tool call. */
export const MCP_TOOL_CALL_EVENT = 'mcp_tool_call';
/** Fired in addition to {@link MCP_TOOL_CALL_EVENT} for tools that write. */
export const MCP_WRITE_EVENT = 'mcp_write';

export type McpEventValue = string | number | boolean | string[] | null;

export interface McpInstrumentationEvent {
  event: typeof MCP_TOOL_CALL_EVENT | typeof MCP_WRITE_EVENT;
  /** Who made the call: the caller's id, or a throwaway id when anonymous. */
  distinctId: string;
  /**
   * True when `distinctId` was generated for this call rather than naming a
   * user. A sink should not build a person profile for it.
   */
  anonymous: boolean;
  properties: Record<string, McpEventValue>;
}

export interface McpInstrumentationContext {
  /**
   * Receives each event. Called without being awaited: a returned promise is
   * left to settle on its own, and a throw or rejection is swallowed. A
   * serverless caller that must flush before the function is frozen keeps the
   * promises itself.
   */
  emit: (event: McpInstrumentationEvent) => void | Promise<void>;
  /**
   * A stable, non-sensitive id for the caller, such as a user uuid; never an
   * email or a token. Omit for an unauthenticated caller, which then gets a
   * fresh random id per call and `anonymous: true`.
   */
  distinctId?: string;
  /** Sent with every event, e.g. `{ role, server }`. Keep it free of user content. */
  properties?: Record<string, McpEventValue>;
}

/** A write tool says so with `readOnlyHint: false`; no annotation counts as a read. */
const isWriteTool = (tool: McpToolDefinition): boolean =>
  tool.annotations?.readOnlyHint === false;

/**
 * Arguments whose value is a work identifier, and the property each is sent
 * as. Every other argument is reported by key only: values may hold
 * translation text or tokens. The value must also look like an identifier.
 */
const IDENTIFIER_ARGS: Record<string, { property: string; pattern: RegExp }> = {
  workUuid: { property: 'work_uuid', pattern: /^[0-9a-f-]{32,36}$/i },
  // The shape of a catalogue number: toh345, Toh 1069-1073, toh539a.
  toh: {
    property: 'toh',
    pattern: /^toh\s?\d{1,5}[a-z]{0,2}(?:[-–]\d{1,5}[a-z]{0,2})?$/i,
  },
};

const argumentsOf = (
  tool: McpToolDefinition,
  args: unknown[],
): Record<string, unknown> => {
  const first = args[0];
  // No schema, no arguments to read; and a handler's first parameter must
  // never be mistaken for them.
  if (Object.keys(tool.inputSchema ?? {}).length === 0) return {};
  return first && typeof first === 'object' && !Array.isArray(first)
    ? (first as Record<string, unknown>)
    : {};
};

const argumentProperties = (
  given: Record<string, unknown>,
): Record<string, McpEventValue> => {
  const properties: Record<string, McpEventValue> = {
    arg_keys: Object.keys(given).sort(),
  };
  // Not sensitive, and what tells a rehearsal from a write.
  if (typeof given['dryRun'] === 'boolean')
    properties['dry_run'] = given['dryRun'];
  for (const [key, { property, pattern }] of Object.entries(IDENTIFIER_ARGS)) {
    const value = given[key];
    if (typeof value === 'string' && pattern.test(value)) {
      properties[property] = value;
    }
  }
  return properties;
};

/**
 * A status for a failed result, which never repeats the error text. Tools echo
 * their arguments into error messages (a toh, a filename) and the database
 * echoes the value it rejected, so any message could carry what was sent.
 * Only a JSON error's `reason` is used, since a reason is a fixed code (a
 * policy conflict also carries the live policy text, which never leaves);
 * anything else is a bare `error`.
 */
const failureStatus = (result: CallToolResult): string => {
  const first = (result.content ?? []).find((part) => part.type === 'text') as
    | { text?: unknown }
    | undefined;
  const text = typeof first?.text === 'string' ? first.text.trim() : '';
  if (!text.startsWith('{')) return 'error';
  try {
    const { reason } = JSON.parse(text) as { reason?: unknown };
    return typeof reason === 'string' && /^[\w.-]{1,64}$/.test(reason)
      ? reason
      : 'error';
  } catch {
    return 'error';
  }
};

/** The error's class only: its message may repeat what the caller sent. */
const thrownStatus = (error: unknown): string =>
  error instanceof Error && /^\w{1,64}$/.test(error.name)
    ? `threw ${error.name}`
    : 'threw';

const emitSafely = (
  context: McpInstrumentationContext,
  event: McpInstrumentationEvent,
): void => {
  try {
    const pending = context.emit(event);
    if (pending && typeof pending.then === 'function') {
      pending.then(undefined, () => undefined);
    }
  } catch {
    // Analytics must never change what a tool call does.
  }
};

const report = (
  context: McpInstrumentationContext,
  tool: McpToolDefinition,
  args: unknown[],
  startedAt: number,
  outcome: { isError: boolean; message?: string },
): void => {
  try {
    const write = isWriteTool(tool);
    const anonymous = !context.distinctId;
    const distinctId = context.distinctId ?? `anonymous-${randomId()}`;
    const properties: Record<string, McpEventValue> = {
      ...context.properties,
      tool_name: tool.name,
      duration_ms: Math.max(0, Math.round(Date.now() - startedAt)),
      is_error: outcome.isError,
      is_write: write,
      ...argumentProperties(argumentsOf(tool, args)),
    };
    emitSafely(context, {
      event: MCP_TOOL_CALL_EVENT,
      distinctId,
      anonymous,
      properties,
    });
    // A dry run rehearses a write and changes nothing, so it is not one.
    if (write && properties['dry_run'] !== true) {
      emitSafely(context, {
        event: MCP_WRITE_EVENT,
        distinctId,
        anonymous,
        properties: {
          ...properties,
          success: !outcome.isError,
          status_message: outcome.isError ? (outcome.message ?? 'error') : 'ok',
        },
      });
    }
  } catch {
    // As above: reporting is best effort.
  }
};

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Wraps each tool so its calls are reported to `context.emit`: an
 * {@link MCP_TOOL_CALL_EVENT} for every call and, for write tools, an
 * {@link MCP_WRITE_EVENT} with whether it succeeded and a short status.
 *
 * The wrapper observes and never alters: the result is returned as is, a
 * thrown error is rethrown as is, and the event is emitted without being
 * awaited, with any failure of `emit` swallowed.
 *
 * A call the MCP SDK rejects before the handler runs (an unknown tool, invalid
 * arguments) is not seen. A write tool is one annotated `readOnlyHint: false`,
 * which includes policy, session-document, feedback and profile-tag writes as
 * well as passage edits and imports; filter on `tool_name` for a subset. A
 * `dryRun: true` call reports `mcp_tool_call` only, with `dry_run: true`.
 *
 * Failures report a status and never an error message, which may repeat
 * argument values: the JSON `reason` of a failed result, else `error`, or
 * `threw <ErrorName>` for an exception.
 *
 * The wrapped handler is a plain async function; the SDK's task-style
 * handlers are not supported.
 *
 * Properties are the tool name, duration, whether it errored, the argument
 * keys (never values), the work uuid or toh when given as such, and whatever
 * `context.properties` adds. Wrap the tools before other wrappers so the
 * duration is the tool's own.
 */
export function withInstrumentation(
  tools: McpToolDefinition[],
  context: McpInstrumentationContext,
): McpToolDefinition[] {
  return tools.map((tool) => {
    const handler = tool.handler as (
      ...args: unknown[]
    ) => CallToolResult | Promise<CallToolResult>;
    return {
      ...tool,
      handler: (async (...args: unknown[]) => {
        const startedAt = Date.now();
        let result: CallToolResult;
        try {
          result = await handler(...args);
        } catch (error) {
          report(context, tool, args, startedAt, {
            isError: true,
            message: thrownStatus(error),
          });
          throw error;
        }
        const isError = result?.isError === true;
        report(context, tool, args, startedAt, {
          isError,
          message: isError ? failureStatus(result) : undefined,
        });
        return result;
      }) as McpToolDefinition['handler'],
    };
  });
}
