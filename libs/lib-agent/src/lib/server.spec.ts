/**
 * @jest-environment node
 */
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { createMcpHandler } from './server';
import {
  createHarnessTools,
  POLICY_EDITOR_RESOURCE_URI,
  POLICY_TOOL_NAMES,
} from './tools/harness';
import type {
  McpPromptDefinition,
  McpResourceDefinition,
  McpToolDefinition,
} from './types';

// Only the tool definitions are exercised; no handler runs.
jest.mock('@eightyfourthousand/data-access', () => ({}));

const askTool: McpToolDefinition = {
  name: 'ask_test',
  description: 'A test tool',
  inputSchema: { query: z.string().optional() },
  handler: async () => ({ content: [{ type: 'text', text: 'hi' }] }),
};

const askPrompt: McpPromptDefinition = {
  name: 'test-agent',
  title: 'test-agent',
  description: 'A test agent prompt',
  argsSchema: { query: z.string().optional() },
  handler: () => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: 'You are a test agent.' },
      },
    ],
  }),
};

async function rpc(
  handler: ReturnType<typeof createMcpHandler>,
  body: unknown,
): Promise<Record<string, unknown>> {
  const res = await handler.POST(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  // Response is either JSON or an SSE frame ("event: message\ndata: {...}")
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  return JSON.parse(dataLine ? dataLine.slice(6) : text);
}

const init = {
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.0' },
  },
};

describe('createMcpHandler prompt + tool surface', () => {
  it('lists registered prompts over JSON-RPC', async () => {
    const handler = createMcpHandler({
      tools: [askTool],
      prompts: [askPrompt],
    });
    await rpc(handler, init);
    const listed = await rpc(handler, {
      jsonrpc: '2.0',
      id: 1,
      method: 'prompts/list',
      params: {},
    });
    const prompts = (listed.result as { prompts: { name: string }[] }).prompts;
    expect(prompts.map((p) => p.name)).toContain('test-agent');
  });

  it('returns prompt messages on prompts/get', async () => {
    const handler = createMcpHandler({
      tools: [askTool],
      prompts: [askPrompt],
    });
    await rpc(handler, init);
    const got = await rpc(handler, {
      jsonrpc: '2.0',
      id: 2,
      method: 'prompts/get',
      params: { name: 'test-agent', arguments: {} },
    });
    const messages = (
      got.result as { messages: { content: { text: string } }[] }
    ).messages;
    expect(messages[0].content.text).toContain('You are a test agent.');
  });

  it('lists the agent tool alongside prompts', async () => {
    const handler = createMcpHandler({
      tools: [askTool],
      prompts: [askPrompt],
    });
    await rpc(handler, init);
    const listed = await rpc(handler, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {},
    });
    const tools = (listed.result as { tools: { name: string }[] }).tools;
    expect(tools.map((t) => t.name)).toContain('ask_test');
  });

  it('forwards a tool definition _meta to tools/list', async () => {
    const ui = { resourceUri: 'ui://test/app.html', visibility: ['app'] };
    const handler = createMcpHandler({
      tools: [askTool, { ...askTool, name: 'app_test', _meta: { ui } }],
    });
    await rpc(handler, init);
    const listed = await rpc(handler, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/list',
      params: {},
    });
    const tools = (
      listed.result as { tools: { name: string; _meta?: unknown }[] }
    ).tools;
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName['app_test']._meta).toEqual({ ui });
    expect(byName['ask_test']._meta).toBeUndefined();
  });

  it('lists the policy tools with _meta.ui on exactly the editor tools', async () => {
    const handler = createMcpHandler({
      tools: createHarnessTools({} as DataClient),
    });
    await rpc(handler, init);
    const listed = await rpc(handler, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/list',
      params: {},
    });
    const tools = (
      listed.result as { tools: { name: string; _meta?: unknown }[] }
    ).tools;
    const withUi = tools.filter(
      (t) => (t._meta as { ui?: unknown } | undefined)?.ui,
    );
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    expect(tools).toHaveLength(7);
    expect(withUi.map((t) => t.name).sort()).toEqual(
      [
        POLICY_TOOL_NAMES.history,
        POLICY_TOOL_NAMES.readRevision,
        POLICY_TOOL_NAMES.restore,
        POLICY_TOOL_NAMES.delete,
        POLICY_TOOL_NAMES.rename,
      ].sort(),
    );
    for (const tool of withUi) {
      expect(tool._meta).toEqual({
        ui: { resourceUri: POLICY_EDITOR_RESOURCE_URI, visibility: ['app'] },
      });
    }
    expect(byName[POLICY_TOOL_NAMES.read]._meta).toBeUndefined();
    expect(byName[POLICY_TOOL_NAMES.write]._meta).toBeUndefined();
  });

  it('lists and reads resources, static or computed, with content _meta', async () => {
    const resource: McpResourceDefinition = {
      name: 'test-app',
      uri: 'ui://test/app.html',
      description: 'A test app',
      mimeType: 'text/html;profile=mcp-app',
      text: async () => '<html>hi</html>',
      _meta: { ui: { prefersBorder: true } },
    };
    const staticResource: McpResourceDefinition = {
      name: 'static-app',
      uri: 'ui://test/static.html',
      mimeType: 'text/html',
      text: '<html>static</html>',
    };
    const handler = createMcpHandler({
      tools: [],
      resources: [resource, staticResource],
    });
    await rpc(handler, init);
    const listed = await rpc(handler, {
      jsonrpc: '2.0',
      id: 6,
      method: 'resources/list',
      params: {},
    });
    const read = await rpc(handler, {
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: { uri: resource.uri },
    });
    const readStatic = await rpc(handler, {
      jsonrpc: '2.0',
      id: 8,
      method: 'resources/read',
      params: { uri: staticResource.uri },
    });

    expect((listed.result as { resources: unknown[] }).resources).toEqual([
      {
        name: 'test-app',
        uri: 'ui://test/app.html',
        description: 'A test app',
        mimeType: 'text/html;profile=mcp-app',
      },
      {
        name: 'static-app',
        uri: 'ui://test/static.html',
        mimeType: 'text/html',
      },
    ]);
    expect((readStatic.result as { contents: unknown[] }).contents).toEqual([
      {
        uri: 'ui://test/static.html',
        mimeType: 'text/html',
        text: '<html>static</html>',
      },
    ]);
    expect((read.result as { contents: unknown[] }).contents).toEqual([
      {
        uri: 'ui://test/app.html',
        mimeType: 'text/html;profile=mcp-app',
        text: '<html>hi</html>',
        _meta: { ui: { prefersBorder: true } },
      },
    ]);
  });
});
