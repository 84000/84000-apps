import { z } from 'zod';
import type { UserRole } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../types';
import { textResult } from '../tools/read/util';
import { hasRole } from '../auth';
import { listAgents } from './registry';
import { buildAgentInstructions } from './invocation';

const ACTIVATION_PREAMBLE =
  'Adopt the following role for the remainder of this conversation, and use the connected 84000 library tools to fulfil the request.';

/**
 * Fallback for clients that do not surface MCP prompts. Each role-permitted
 * agent becomes an `ask_<name>` tool whose result steers the current chat into
 * the agent's role (optionally scoped to a `query`).
 */
export function createAgentTools(userRole: UserRole): McpToolDefinition[] {
  return listAgents()
    .filter((agent) => hasRole(userRole, agent.requiredRole))
    .map((agent) => ({
      name: `ask_${agent.name.replace(/-/g, '_')}`,
      description: agent.description,
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Optional request to pass to the agent'),
      },
      annotations: {
        title: agent.name,
        readOnlyHint: true,
        openWorldHint: false,
      },
      handler: async ({ query }) =>
        textResult(
          `${ACTIVATION_PREAMBLE}\n\n${buildAgentInstructions(agent, query)}`,
        ),
    }));
}
