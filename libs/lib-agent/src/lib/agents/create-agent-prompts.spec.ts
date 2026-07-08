/**
 * @jest-environment node
 */
import type { AgentDefinition } from './types';
import { registerAgent, clearAgents } from './registry';
import { createAgentPrompts } from './create-agent-prompts';

const translatorAgent: AgentDefinition = {
  name: 'test-translator',
  description: 'A translator-level agent',
  systemPrompt: 'You are a translator agent.',
  tools: ['tool-a'],
  requiredRole: 'translator',
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
  registerAgent(translatorAgent);
  registerAgent(editorAgent);
});

describe('createAgentPrompts', () => {
  it('returns prompts for agents the user role can access', () => {
    const prompts = createAgentPrompts('admin');
    expect(prompts.map((p) => p.name)).toEqual([
      'test-translator',
      'test-editor',
    ]);
  });

  it('excludes agents above the user role', () => {
    const prompts = createAgentPrompts('translator');
    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe('test-translator');
  });

  it('excludes all agents below the required role', () => {
    const prompts = createAgentPrompts('reader');
    expect(prompts).toHaveLength(0);
  });

  it('handler returns the system prompt as a user message', () => {
    const prompt = createAgentPrompts('translator')[0];
    const result = prompt.handler(
      {},
      {} as Parameters<typeof prompt.handler>[1],
    );
    const message = (
      result as { messages: { role: string; content: { text: string } }[] }
    ).messages[0];

    expect(message.role).toBe('user');
    expect(message.content.text).toContain('You are a translator agent.');
  });

  it('handler embeds the query when provided', () => {
    const prompt = createAgentPrompts('translator')[0];
    const result = prompt.handler(
      { query: 'Summarize toh44' },
      {} as Parameters<typeof prompt.handler>[1],
    );
    const message = (result as { messages: { content: { text: string } }[] })
      .messages[0];

    expect(message.content.text).toContain('Summarize toh44');
    expect(message.content.text).toContain('Current request');
  });
});
