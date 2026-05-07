import { AgentDefinitionSchema, type AgentDefinition } from './types';

const agents = new Map<string, AgentDefinition>();

export function registerAgent(definition: AgentDefinition): void {
  const parsed = AgentDefinitionSchema.parse(definition);
  agents.set(parsed.name, parsed);
}

export function getAgent(name: string): AgentDefinition | null {
  return agents.get(name) ?? null;
}

export function listAgents(): AgentDefinition[] {
  return Array.from(agents.values());
}

export function clearAgents(): void {
  agents.clear();
}
