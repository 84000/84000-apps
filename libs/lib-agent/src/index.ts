export { createMcpHandler } from './lib/server';
export type {
  McpToolDefinition,
  McpPromptDefinition,
  McpHandlerOptions,
} from './lib/types';
export { readToolInstructions, joinInstructions } from './lib/instructions';
export type { ReadToolInstructionsOptions } from './lib/instructions';
export { createReadTools } from './lib/tools/read';
export { createWriteTools } from './lib/tools/write';
export {
  validateBearerToken,
  requirePermission,
  decodeRole,
  hasRole,
  ROLE_HIERARCHY,
} from './lib/auth';
export {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
  withCorsHeaders,
} from './lib/cors';
export type {
  AuthResult,
  AuthSuccess,
  AuthFailure,
  PermissionResult,
} from './lib/auth';
