export type FlowStep = `step${number}`;

export const OUTPUT_SCHEMA_KEYS = [
  'result',
  'steps',
  'links',
  'answer',
] as const;
export type OutputSchemaKey = (typeof OUTPUT_SCHEMA_KEYS)[number];

export const INPUT_SCHEMA_KEYS = [
  'query',
  'history',
  'steps',
  'research',
] as const;
export type InputSchemaKey = (typeof INPUT_SCHEMA_KEYS)[number];

export const OUTPUT_TYPES = ['steps', 'result', 'links', 'answer'] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export const SCHEME_VALUE_TYPES = ['string', 'array', 'object'] as const;
export type SchemeValueType = (typeof SCHEME_VALUE_TYPES)[number];

export type MessageRole = 'user' | 'assistant';
export type FlowMode = 'sync' | 'async';

export type FlowResult = { [key in FlowStep]?: Message };
export type FlowOutputData = { [key in OutputType]?: unknown };
export type FlowInputData = { [key in InputSchemaKey]?: unknown };

export type StepResult = {
  stepId: string;
  stepName: string;
  success: boolean;
  data?: Message;
  error?: string;
};

export type Message = FlowOutputData &
  FlowInputData & {
    role: MessageRole;
    message: string;
    research?: string;
    isProcessing?: boolean;
    isTyping?: boolean;
    references?: string[];
    steps?: string;
    links?: string[];
    answer?: string;
  };

export interface FlowConfig {
  name: string;
  workflowId: string;
  description: string;
  mode: 'sync' | 'async';
  dependsOn?: string[];
  expectedOutput: OutputType[];
  inputSchema: Partial<Record<InputSchemaKey, SchemeValueType>>;
  outputSchema: Partial<Record<OutputSchemaKey, SchemeValueType>>;
}

export type LamaticConfig = {
  api: {
    endpoint: string;
    projectId: string;
  };
  suggestions: string[];
  flows: {
    [key in FlowStep]: FlowConfig;
  };
};
