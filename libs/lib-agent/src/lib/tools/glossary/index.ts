import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { createPlanGlossaryInstancesTool } from './plan-glossary-instances';

/**
 * Tools that resolve a work's glossary instances. Each checks its own
 * permission.
 */
export function createGlossaryResolveTools(
  client: DataClient,
  userId: string,
  // Taken now so the route does not change when the write tools join.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: { write?: boolean } = {},
): McpToolDefinition[] {
  return [createPlanGlossaryInstancesTool(client)];
}

export { createPlanGlossaryInstancesTool } from './plan-glossary-instances';
