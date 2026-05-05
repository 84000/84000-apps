import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpHandlerOptions } from './types';

export function createMcpHandler(options: McpHandlerOptions) {
  const { name = '84000-mcp', version = '1.0.0', tools } = options;

  async function GET(): Promise<Response> {
    return new Response('Method not allowed', { status: 405 });
  }

  async function POST(req: Request): Promise<Response> {
    try {
      const server = new McpServer({ name, version });

      for (const tool of tools) {
        server.tool(tool.name, tool.description, tool.schema, tool.handler);
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

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
