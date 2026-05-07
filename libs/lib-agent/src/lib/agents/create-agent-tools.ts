import type { UserRole } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../types';
import { jsonResult } from '../tools/read/util';
import { ROLE_HIERARCHY } from '../auth';
import { listAgents } from './registry';

function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole);
}

export function createAgentTools(userRole: UserRole): McpToolDefinition[] {
  return listAgents()
    .filter((agent) => hasRole(userRole, agent.requiredRole))
    .map((agent) => ({
      name: `ask_${agent.name.replace(/-/g, '_')}`,
      description: agent.description,
      inputSchema: {},
      annotations: {
        title: agent.name,
        readOnlyHint: true,
        openWorldHint: false,
      },
      handler: async () =>
        jsonResult({
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools,
          model: agent.model,
        }),
    }));
}
