export type { AgentDefinition } from './types';
export { AgentDefinitionSchema } from './types';
export {
  registerAgent,
  getAgent,
  listAgents,
  clearAgents,
} from './registry';
export {
  resolveAgentTools,
  resolveAgentHandlerOptions,
} from './resolve';
export { createAgentTools } from './create-agent-tools';

import { registerAgent } from './registry';
import { libraryAssistant } from './library-assistant/definition';

registerAgent(libraryAssistant);
