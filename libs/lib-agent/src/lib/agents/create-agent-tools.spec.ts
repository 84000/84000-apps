/**
 * @jest-environment node
 */
import type { AgentDefinition } from './types';
import { registerAgent, clearAgents } from './registry';
import { createAgentTools } from './create-agent-tools';

const readerAgent: AgentDefinition = {
  name: 'test-reader',
  description: 'A reader-level agent',
  systemPrompt: 'You are a test agent.',
  tools: ['tool-a', 'tool-b'],
  requiredRole: 'reader',
  model: 'claude-sonnet-4-20250514',
};

const editorAgent: AgentDefinition = {
  name: 'test-editor',
  description: 'An editor-level agent',
  systemPrompt: 'You are an editor agent.',
  tools: ['tool-c'],
  requiredRole: 'editor',
};

beforeEach(() => {
  clearAgents();
  registerAgent(readerAgent);
  registerAgent(editorAgent);
});

describe('createAgentTools', () => {
  it('returns tools for agents the user role can access', () => {
    const tools = createAgentTools('admin');
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual([
      'ask_test_reader',
      'ask_test_editor',
    ]);
  });

  it('excludes agents above the user role', () => {
    const tools = createAgentTools('reader');
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('ask_test_reader');
  });

  it('returns empty array when no agents are accessible', () => {
    clearAgents();
    registerAgent(editorAgent);
    const tools = createAgentTools('reader');
    expect(tools).toHaveLength(0);
  });

  it('tool name replaces hyphens with underscores', () => {
    clearAgents();
    registerAgent({ ...readerAgent, name: 'my-hyphenated-agent' });
    const tools = createAgentTools('reader');
    expect(tools[0].name).toBe('ask_my_hyphenated_agent');
  });

  it('handler returns agent config without requiredRole', async () => {
    const tools = createAgentTools('reader');
    const result = await tools[0].handler({});
    const content = result.content as { type: string; text: string }[];
    const config = JSON.parse(content[0].text);

    expect(config).toEqual({
      name: 'test-reader',
      description: 'A reader-level agent',
      systemPrompt: 'You are a test agent.',
      tools: ['tool-a', 'tool-b'],
      model: 'claude-sonnet-4-20250514',
    });
    expect(config).not.toHaveProperty('requiredRole');
  });

  it('handler omits model when undefined', async () => {
    const tools = createAgentTools('admin');
    const editorTool = tools.find((t) => t.name === 'ask_test_editor')!;
    const result = await editorTool.handler({});
    const content = result.content as { type: string; text: string }[];
    const config = JSON.parse(content[0].text);

    expect(config.model).toBeUndefined();
  });
});
