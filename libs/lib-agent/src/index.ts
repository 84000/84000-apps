export { createMcpHandler } from './lib/server';
export type { McpToolDefinition, McpHandlerOptions } from './lib/types';
export { createReadTools } from './lib/tools/read';
export {
  validateBearerToken,
  requirePermission,
  decodeRole,
  ROLE_HIERARCHY,
} from './lib/auth';
export type {
  AuthResult,
  AuthSuccess,
  AuthFailure,
  PermissionResult,
} from './lib/auth';
