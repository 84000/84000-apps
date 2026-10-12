import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import type { McpToolDefinition } from './types';

/** Fired for every tool call. */
export const MCP_TOOL_CALL_EVENT = 'mcp_tool_call';
/** Fired in addition to {@link MCP_TOOL_CALL_EVENT} for tools that write. */
export const MCP_WRITE_EVENT = 'mcp_write';

/** The longest status message sent, so an error can never carry a document. */
export const MAX_STATUS_MESSAGE_LENGTH = 200;

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
  toh: { property: 'toh', pattern: /^[A-Za-z0-9._ -]{1,24}$/ },
};

const argumentsOf = (
  tool: McpToolDefinition,
  args: unknown[],
): Record<string, unknown> => {
  const first = args[0];
  // A tool without an input schema is called with the request extras first,
  // not arguments; those must never be mistaken for them.
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
  for (const [key, { property, pattern }] of Object.entries(IDENTIFIER_ARGS)) {
    const value = given[key];
    if (typeof value === 'string' && pattern.test(value)) {
      properties[property] = value;
    }
  }
  return properties;
};

const truncate = (text: string): string => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > MAX_STATUS_MESSAGE_LENGTH
    ? `${line.slice(0, MAX_STATUS_MESSAGE_LENGTH - 1)}…`
    : line;
};

/**
 * A short status for a failed result. A plain-text error is sent truncated.
 * A JSON error (a policy conflict carries the live policy text) is reduced to
 * its `reason`, or to a bare `error` when it has none, so content never leaves.
 */
const failureMessage = (result: CallToolResult): string => {
  const first = (result.content ?? []).find((part) => part.type === 'text') as
    | { text?: unknown }
    | undefined;
  const text = typeof first?.text === 'string' ? first.text.trim() : '';
  if (!text) return 'error';
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as { reason?: unknown };
      return typeof parsed?.reason === 'string'
        ? truncate(parsed.reason)
        : 'error';
    } catch {
      return 'error';
    }
  }
  return truncate(text);
};

const thrownMessage = (error: unknown): string =>
  error instanceof Error
    ? truncate(`${error.name}: ${error.message}`)
    : 'threw a non-error value';

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
    if (write) {
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
            message: thrownMessage(error),
          });
          throw error;
        }
        const isError = result?.isError === true;
        report(context, tool, args, startedAt, {
          isError,
          message: isError ? failureMessage(result) : undefined,
        });
        return result;
      }) as McpToolDefinition['handler'],
    };
  });
}
