import type { McpToolDefinition, McpHandlerOptions } from '../types';
import type { AgentDefinition } from './types';

export function resolveAgentTools(
  agent: AgentDefinition,
  availableTools: McpToolDefinition[],
): McpToolDefinition[] {
  const toolSet = new Set(agent.tools);
  return availableTools.filter((t) => toolSet.has(t.name));
}

export function resolveAgentHandlerOptions(
  agent: AgentDefinition,
  availableTools: McpToolDefinition[],
): McpHandlerOptions {
  return {
    name: agent.name,
    description: agent.description,
    instructions: agent.systemPrompt,
    tools: resolveAgentTools(agent, availableTools),
  };
}
