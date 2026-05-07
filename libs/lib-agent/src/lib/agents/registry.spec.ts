/**
 * @jest-environment node
 */
import type { AgentDefinition } from './types';
import { registerAgent, getAgent, listAgents, clearAgents } from './registry';

const validAgent: AgentDefinition = {
  name: 'test-agent',
  description: 'A test agent',
  systemPrompt: 'You are a test agent.',
  tools: ['tool-a', 'tool-b'],
  requiredRole: 'reader',
};

describe('registerAgent', () => {
  beforeEach(() => clearAgents());

  it('registers a valid agent definition', () => {
    registerAgent(validAgent);
    expect(getAgent('test-agent')).toEqual(validAgent);
  });

  it('throws on invalid definition (missing name)', () => {
    expect(() =>
      registerAgent({ ...validAgent, name: '' } as AgentDefinition),
    ).toThrow();
  });

  it('throws on invalid definition (empty systemPrompt)', () => {
    expect(() =>
      registerAgent({ ...validAgent, systemPrompt: '' } as AgentDefinition),
    ).toThrow();
  });

  it('overwrites an existing agent with the same name', () => {
    registerAgent(validAgent);
    const updated = { ...validAgent, description: 'Updated description' };
    registerAgent(updated);
    expect(getAgent('test-agent')?.description).toBe('Updated description');
  });
});

describe('getAgent', () => {
  beforeEach(() => clearAgents());

  it('returns null for an unknown agent name', () => {
    expect(getAgent('nonexistent')).toBeNull();
  });

  it('returns the registered agent by name', () => {
    registerAgent(validAgent);
    expect(getAgent('test-agent')).toEqual(validAgent);
  });
});

describe('listAgents', () => {
  beforeEach(() => clearAgents());

  it('returns an empty array when no agents are registered', () => {
    expect(listAgents()).toEqual([]);
  });

  it('returns all registered agents', () => {
    const agentB: AgentDefinition = {
      ...validAgent,
      name: 'agent-b',
      description: 'Another agent',
    };
    registerAgent(validAgent);
    registerAgent(agentB);
    expect(listAgents()).toHaveLength(2);
    expect(listAgents().map((a) => a.name)).toEqual([
      'test-agent',
      'agent-b',
    ]);
  });
});
