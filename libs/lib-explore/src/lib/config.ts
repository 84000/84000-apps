import { LamaticConfig } from './types';

export const config: LamaticConfig = {
  api: {
    endpoint: 'https://84000925-globalsearch883.lamatic.dev/graphql',
    projectId: '61113b5c-8966-47f9-9021-02937385ef95',
  },
  suggestions: ['Help me explore the different meanings of karma.'],
  flows: {
    step1: {
      name: 'Generate Steps',
      workflowId: 'e3ce7c46-69e2-440f-bb13-4acb2148a13e',
      description: 'Generates high-level reasoning steps for the query',
      mode: 'sync',
      expectedOutput: ['answer', 'mode'],
      inputSchema: {
        chatMessage: 'string',
        chatHistory: 'array',
      },
      outputSchema: {
        answer: 'string',
        mode: 'string',
      },
    },
  },
} as const;
