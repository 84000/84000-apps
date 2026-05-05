import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';

export interface McpToolDefinition<
  T extends ZodRawShapeCompat = ZodRawShapeCompat,
> {
  name: string;
  description: string;
  schema: T;
  handler: ToolCallback<T>;
}

export interface McpHandlerOptions {
  name?: string;
  version?: string;
  tools: McpToolDefinition[];
}
