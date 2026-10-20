import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpHandlerOptions } from './types';

/** Whether a JSON-RPC body, one message or a batch, opens a session. */
async function isInitialize(req: Request): Promise<boolean> {
  try {
    const body: unknown = await req.clone().json();
    const messages = Array.isArray(body) ? body : [body];
    return messages.some(
      (message) =>
        (message as { method?: unknown } | null)?.method === 'initialize',
    );
  } catch {
    return false;
  }
}

export function createMcpHandler(options: McpHandlerOptions) {
  const {
    name = '84000-mcp',
    version = '2026.10.8',
    description,
    instructions,
    tools,
    prompts = [],
    resources = [],
  } = options;

  function buildServer(instructions: string | undefined): McpServer {
    const server = new McpServer(
      { name, version, description },
      { instructions },
    );

    for (const tool of tools) {
      const {
        name,
        description,
        inputSchema,
        outputSchema,
        annotations,
        _meta,
        handler,
      } = tool;
      server.registerTool(
        name,
        {
          description,
          inputSchema,
          outputSchema,
          annotations,
          _meta,
        },
        handler,
      );
    }

    for (const prompt of prompts) {
      const { name, title, description, argsSchema, handler } = prompt;
      server.registerPrompt(name, { title, description, argsSchema }, handler);
    }

    for (const resource of resources) {
      const { name, uri, title, description, mimeType, text, _meta } = resource;
      server.registerResource(
        name,
        uri,
        { title, description, mimeType },
        async () => ({
          contents: [
            {
              uri,
              mimeType,
              text: typeof text === 'function' ? await text() : text,
              ...(_meta && { _meta }),
            },
          ],
        }),
      );
    }

    if (tools.length === 0 && prompts.length === 0 && resources.length === 0) {
      const placeholder = server.registerTool(
        '_init',
        { description: 'placeholder' },
        async () => ({
          content: [],
        }),
      );
      placeholder.remove();
    }

    return server;
  }

  async function GET(): Promise<Response> {
    return new Response('Method not allowed', { status: 405 });
  }

  async function POST(req: Request): Promise<Response> {
    try {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      const server = buildServer(
        typeof instructions === 'function'
          ? (await isInitialize(req))
            ? await instructions()
            : undefined
          : instructions,
      );
      await server.connect(transport);

      return await transport.handleRequest(req);
    } catch (error) {
      console.error('MCP request failed:', error);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }

  async function DELETE(): Promise<Response> {
    return new Response('Method not allowed', { status: 405 });
  }

  return { GET, POST, DELETE };
}
