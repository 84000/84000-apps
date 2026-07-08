import type {
  ToolCallback,
  PromptCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types';

export interface McpToolDefinition<
  T extends ZodRawShapeCompat = ZodRawShapeCompat,
  U extends ZodRawShapeCompat = ZodRawShapeCompat,
> {
  name: string;
  description: string;
  inputSchema: T;
  outputSchema?: U;
  annotations?: ToolAnnotations;
  handler: ToolCallback<T>;
}

export interface McpPromptDefinition<
  Args extends ZodRawShapeCompat = ZodRawShapeCompat,
> {
  name: string;
  title?: string;
  description?: string;
  argsSchema?: Args;
  handler: PromptCallback<Args>;
}

export interface McpHandlerOptions {
  name?: string;
  version?: string;
  description?: string;
  instructions?: string;
  tools: McpToolDefinition[];
  prompts?: McpPromptDefinition[];
}
