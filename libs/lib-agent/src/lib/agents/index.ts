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

import { registerAgent } from './registry';
import { libraryAssistant } from './definitions/library-assistant';

registerAgent(libraryAssistant);
