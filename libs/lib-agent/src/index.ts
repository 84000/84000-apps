export { createMcpHandler } from './lib/server';
export type {
  McpToolDefinition,
  McpPromptDefinition,
  McpHandlerOptions,
} from './lib/types';
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
export type { AgentDefinition } from './lib/agents';
export {
  AgentDefinitionSchema,
  registerAgent,
  getAgent,
  listAgents,
  clearAgents,
  resolveAgentTools,
  resolveAgentHandlerOptions,
  createAgentTools,
  createAgentPrompts,
  buildAgentInstructions,
} from './lib/agents';
