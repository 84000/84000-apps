import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';

import { createReadPoliciesTool } from './read-policies';
import { createWritePolicyTool } from './write-policy';

/**
 * Policy tools, kept apart from the read and write tool sets because their
 * audience is different: the studio route lists write tools for editors only,
 * while policy authorship reaches translators too. Each handler checks its own
 * `harness.*` permission, which is the authoritative gate.
 */
export function createHarnessTools(client: DataClient): McpToolDefinition[] {
  return [createReadPoliciesTool(client), createWritePolicyTool(client)];
}

export { createReadPoliciesTool } from './read-policies';
export { createWritePolicyTool } from './write-policy';
