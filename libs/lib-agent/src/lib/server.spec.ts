/**
 * @jest-environment node
 */
import { z } from 'zod';
import { createMcpHandler } from './server';
import type { McpPromptDefinition, McpToolDefinition } from './types';

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
      { role: 'user', content: { type: 'text', text: 'You are a test agent.' } },
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
  const dataLine = text
    .split('\n')
    .find((l) => l.startsWith('data: '));
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
    const handler = createMcpHandler({ tools: [askTool], prompts: [askPrompt] });
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
    const handler = createMcpHandler({ tools: [askTool], prompts: [askPrompt] });
    await rpc(handler, init);
    const got = await rpc(handler, {
      jsonrpc: '2.0',
      id: 2,
      method: 'prompts/get',
      params: { name: 'test-agent', arguments: {} },
    });
    const messages = (got.result as { messages: { content: { text: string } }[] })
      .messages;
    expect(messages[0].content.text).toContain('You are a test agent.');
  });

  it('lists the agent tool alongside prompts', async () => {
    const handler = createMcpHandler({ tools: [askTool], prompts: [askPrompt] });
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
});
