import type { AgentDefinition } from './types';

/**
 * Builds the instruction text that turns the calling chat into the agent.
 * Both the MCP prompt and the fallback tool return this so an agent is
 * "invoked" simply by steering the current conversation — no server-side
 * agent loop or model call is involved.
 */
export function buildAgentInstructions(
  agent: AgentDefinition,
  query?: string,
): string {
  const base = agent.systemPrompt.trim();
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return base;
  }
  return `${base}\n\n## Current request\n\n${trimmedQuery}`;
}
