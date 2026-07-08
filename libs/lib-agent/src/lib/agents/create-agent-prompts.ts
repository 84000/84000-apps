import { z } from 'zod';
import type { UserRole } from '@eightyfourthousand/data-access';
import type { McpPromptDefinition } from '../types';
import { hasRole } from '../auth';
import { listAgents } from './registry';
import { buildAgentInstructions } from './invocation';

/**
 * Exposes each role-permitted agent as an MCP prompt. Selecting the prompt in
 * the connected client injects the agent's instructions (and an optional
 * `query`) into the current conversation, so the chat itself acts as the agent
 * using the read tools already on the connection.
 */
export function createAgentPrompts(userRole: UserRole): McpPromptDefinition[] {
  return listAgents()
    .filter((agent) => hasRole(userRole, agent.requiredRole))
    .map((agent) => ({
      name: agent.name,
      title: agent.name,
      description: agent.description,
      argsSchema: {
        query: z
          .string()
          .optional()
          .describe('Optional request to pass to the agent'),
      },
      handler: ({ query }) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: buildAgentInstructions(agent, query),
            },
          },
        ],
      }),
    }));
}
