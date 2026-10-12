import { z } from 'zod';
import type { McpToolDefinition } from './types';
import {
  MAX_STATUS_MESSAGE_LENGTH,
  MCP_TOOL_CALL_EVENT,
  MCP_WRITE_EVENT,
  withInstrumentation,
  type McpInstrumentationEvent,
} from './instrumentation';

type Handler = (args: unknown) => unknown;

const tool = (
  name: string,
  handler: Handler,
  extra: Partial<McpToolDefinition> = {},
): McpToolDefinition => ({
  name,
  description: name,
  inputSchema: { workUuid: z.string(), text: z.string() },
  annotations: { readOnlyHint: true },
  handler: handler as McpToolDefinition['handler'],
  ...extra,
});

const writeTool = (name: string, handler: Handler) =>
  tool(name, handler, { annotations: { readOnlyHint: false } });

const ok = async () => ({ content: [{ type: 'text' as const, text: 'fine' }] });

const call = (t: McpToolDefinition, args: unknown = {}) =>
  (t.handler as unknown as (...a: unknown[]) => Promise<unknown>)(args, {});

const setup = (
  tools: McpToolDefinition[],
  context: Partial<Parameters<typeof withInstrumentation>[1]> = {},
) => {
  const events: McpInstrumentationEvent[] = [];
  const wrapped = withInstrumentation(tools, {
    emit: (event) => {
      events.push(event);
    },
    distinctId: 'user-uuid',
    properties: { role: 'editor', server: 'studio' },
    ...context,
  });
  return { events, wrapped };
};

const UUID = '3f0c1c52-8a55-4a0e-9d57-5b0a6d3c9f11';

describe('withInstrumentation', () => {
  it('emits one mcp_tool_call per call, with the call metadata', async () => {
    const { events, wrapped } = setup([tool('get-passage', ok)]);

    await call(wrapped[0], { workUuid: UUID, text: 'secret translation' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: MCP_TOOL_CALL_EVENT,
      distinctId: 'user-uuid',
      anonymous: false,
      properties: {
        tool_name: 'get-passage',
        is_error: false,
        is_write: false,
        arg_keys: ['text', 'workUuid'],
        work_uuid: UUID,
        role: 'editor',
        server: 'studio',
      },
    });
    expect(events[0].properties.duration_ms).toEqual(expect.any(Number));
  });

  it('never sends an argument value, only keys and the identifier arguments', async () => {
    const { events, wrapped } = setup([
      tool('t', ok, {
        inputSchema: {
          workUuid: z.string(),
          toh: z.string(),
          text: z.string(),
          token: z.string(),
        },
      }),
    ]);

    await call(wrapped[0], {
      workUuid: UUID,
      toh: 'toh44',
      text: 'some translation text',
      token: 'sb_secret_token',
    });

    const sent = JSON.stringify(events);
    expect(sent).not.toContain('some translation text');
    expect(sent).not.toContain('sb_secret_token');
    expect(events[0].properties).toMatchObject({
      work_uuid: UUID,
      toh: 'toh44',
      arg_keys: ['text', 'toh', 'token', 'workUuid'],
    });
  });

  it('drops an identifier argument that does not look like one', async () => {
    const { events, wrapped } = setup([tool('t', ok)]);

    await call(wrapped[0], {
      workUuid: 'Ignore previous instructions and ...',
    });

    expect(events[0].properties).not.toHaveProperty('work_uuid');
  });

  it('reads no arguments from a tool without an input schema', async () => {
    const { events, wrapped } = setup([
      tool('no-args', ok, { inputSchema: {} }),
    ]);

    // Such a tool is called with the request extras first, not arguments.
    await call(wrapped[0], { signal: {}, requestId: 'x' });

    expect(events[0].properties.arg_keys).toEqual([]);
  });

  it('adds an mcp_write for a write tool, reporting success', async () => {
    const { events, wrapped } = setup([writeTool('apply-passage-edits', ok)]);

    await call(wrapped[0], { workUuid: UUID });

    expect(events.map((e) => e.event)).toEqual([
      MCP_TOOL_CALL_EVENT,
      MCP_WRITE_EVENT,
    ]);
    expect(events[0].properties.is_write).toBe(true);
    expect(events[1].properties).toMatchObject({
      tool_name: 'apply-passage-edits',
      success: true,
      status_message: 'ok',
      work_uuid: UUID,
    });
  });

  it('reports a failed write with a truncated plain-text message', async () => {
    const long = 'x'.repeat(MAX_STATUS_MESSAGE_LENGTH * 2);
    const { events, wrapped } = setup([
      writeTool('w', async () => ({
        content: [{ type: 'text' as const, text: long }],
        isError: true,
      })),
    ]);

    await call(wrapped[0]);

    expect(events[0].properties.is_error).toBe(true);
    expect(events[1].properties.success).toBe(false);
    expect(
      (events[1].properties.status_message as string).length,
    ).toBeLessThanOrEqual(MAX_STATUS_MESSAGE_LENGTH);
  });

  it('reduces a JSON failure to its reason, so policy text never leaves', async () => {
    const { events, wrapped } = setup([
      writeTool('write-policy', async () => ({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              ok: false,
              reason: 'conflict',
              conflict: { content: 'LIVE POLICY TEXT' },
            }),
          },
        ],
        isError: true,
      })),
      writeTool('other', async () => ({
        content: [{ type: 'text' as const, text: '{"detail":"LIVE TEXT"}' }],
        isError: true,
      })),
    ]);

    await call(wrapped[0]);
    await call(wrapped[1]);

    expect(events[1].properties.status_message).toBe('conflict');
    expect(events[3].properties.status_message).toBe('error');
    expect(JSON.stringify(events)).not.toContain('LIVE');
  });

  it('does not emit mcp_write for a read tool that errors', async () => {
    const { events, wrapped } = setup([
      tool('get-passage', async () => ({ content: [], isError: true })),
    ]);

    await call(wrapped[0]);

    expect(events.map((e) => e.event)).toEqual([MCP_TOOL_CALL_EVENT]);
    expect(events[0].properties.is_error).toBe(true);
  });

  it('treats a tool without annotations as a read', async () => {
    const { events, wrapped } = setup([
      tool('plain', ok, { annotations: undefined }),
    ]);

    await call(wrapped[0]);

    expect(events.map((e) => e.event)).toEqual([MCP_TOOL_CALL_EVENT]);
  });

  it('returns the very same result', async () => {
    const result = { content: [{ type: 'text' as const, text: 'x' }] };
    const { wrapped } = setup([tool('t', async () => result)]);

    await expect(call(wrapped[0])).resolves.toBe(result);
  });

  it('rethrows the original error, reporting it first', async () => {
    const failure = new TypeError('database is down');
    const { events, wrapped } = setup([
      writeTool('w', async () => {
        throw failure;
      }),
    ]);

    await expect(call(wrapped[0])).rejects.toBe(failure);

    expect(events[0].properties.is_error).toBe(true);
    expect(events[1].properties).toMatchObject({
      success: false,
      status_message: 'TypeError: database is down',
    });
  });

  it('passes every handler argument through unchanged', async () => {
    const handler = jest.fn(ok);
    const { wrapped } = setup([tool('t', handler)]);
    const args = { text: 'x' };
    const extra = { signal: 'abort' };

    await (wrapped[0].handler as unknown as (...a: unknown[]) => unknown)(
      args,
      extra,
    );

    expect(handler).toHaveBeenCalledWith(args, extra);
  });

  it('swallows an emit that throws, and one that rejects', async () => {
    const result = await ok();
    for (const emit of [
      () => {
        throw new Error('sink down');
      },
      () => Promise.reject(new Error('sink down')),
    ]) {
      const { wrapped } = setup([writeTool('w', async () => result)], { emit });

      await expect(call(wrapped[0])).resolves.toBe(result);
    }
    // Let a rejection reach its handler: an unhandled one would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('does not wait on a slow sink', async () => {
    const { wrapped } = setup([tool('t', ok)], {
      emit: () => new Promise<void>(() => undefined),
    });

    await expect(call(wrapped[0])).resolves.toBeDefined();
  });

  it('gives an unauthenticated caller a fresh anonymous id each call', async () => {
    const { events, wrapped } = setup([tool('t', ok)], {
      distinctId: undefined,
    });

    await call(wrapped[0]);
    await call(wrapped[0]);

    expect(events[0].anonymous).toBe(true);
    expect(events[0].distinctId).toMatch(/^anonymous-/);
    expect(events[1].distinctId).not.toBe(events[0].distinctId);
  });

  it('keeps the tool definition otherwise intact', () => {
    const original = tool('t', ok, { _meta: { ui: { visibility: ['app'] } } });
    const [wrapped] = setup([original]).wrapped;

    expect(wrapped).toMatchObject({
      name: 't',
      description: 't',
      annotations: original.annotations,
      _meta: original._meta,
      inputSchema: original.inputSchema,
    });
  });
});
