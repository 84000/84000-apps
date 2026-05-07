/**
 * @jest-environment node
 */
import type { McpToolDefinition } from '../types';
import type { AgentDefinition } from './types';
import { resolveAgentTools, resolveAgentHandlerOptions } from './resolve';

const agent: AgentDefinition = {
  name: 'test-agent',
  description: 'A test agent',
  systemPrompt: 'You are a test agent.',
  tools: ['tool-a', 'tool-c'],
  requiredRole: 'reader',
};

const makeTool = (name: string): McpToolDefinition => ({
  name,
  description: `Tool ${name}`,
  inputSchema: {},
  handler: async () => ({ content: [] }),
});

const availableTools = [
  makeTool('tool-a'),
  makeTool('tool-b'),
  makeTool('tool-c'),
  makeTool('tool-d'),
];

describe('resolveAgentTools', () => {
  it('filters available tools to those listed in the agent definition', () => {
    const result = resolveAgentTools(agent, availableTools);
    expect(result.map((t) => t.name)).toEqual(['tool-a', 'tool-c']);
  });

  it('returns an empty array when no tools match', () => {
    const noMatchAgent = { ...agent, tools: ['nonexistent'] };
    expect(resolveAgentTools(noMatchAgent, availableTools)).toEqual([]);
  });

  it('preserves order of available tools', () => {
    const reversed = { ...agent, tools: ['tool-c', 'tool-a'] };
    const result = resolveAgentTools(reversed, availableTools);
    expect(result.map((t) => t.name)).toEqual(['tool-a', 'tool-c']);
  });
});

describe('resolveAgentHandlerOptions', () => {
  it('returns McpHandlerOptions with correct fields', () => {
    const options = resolveAgentHandlerOptions(agent, availableTools);
    expect(options).toEqual({
      name: 'test-agent',
      description: 'A test agent',
      instructions: 'You are a test agent.',
      tools: expect.any(Array),
    });
    expect(options.tools).toHaveLength(2);
  });
});
