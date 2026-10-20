import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpHandlerOptions } from './types';

/** The request's JSON body, or undefined when it is not JSON. */
async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

/** Whether a JSON-RPC body, one message or a batch, opens a session. */
function isInitialize(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      (message as { method?: unknown } | null)?.method === 'initialize',
  );
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

      // Only the initialize result carries instructions, so a function is
      // called for that request alone. Reading the body to tell is a parse the
      // transport then reuses; a body that is not JSON is left for the
      // transport to reject.
      let parsedBody: unknown;
      let resolved =
        typeof instructions === 'string' ? instructions : undefined;
      if (typeof instructions === 'function') {
        parsedBody = await readBody(req);
        resolved = isInitialize(parsedBody) ? await instructions() : undefined;
      }
      const server = buildServer(resolved);
      await server.connect(transport);

      return await transport.handleRequest(
        req,
        parsedBody === undefined ? undefined : { parsedBody },
      );
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
