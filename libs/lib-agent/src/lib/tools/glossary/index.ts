import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { createApplyGlossaryInstancesTool } from './apply-glossary-instances';
import { createPlanGlossaryInstancesTool } from './plan-glossary-instances';
import { createRecordGlossaryReviewTool } from './record-glossary-review';

/**
 * Tools that resolve a work's glossary instances: plan (`editor.read`), and
 * with `write`, record review decisions and apply them (`editor.edit`). Each
 * checks its permission.
 */
export function createGlossaryResolveTools(
  client: DataClient,
  userId: string,
  { write = true }: { write?: boolean } = {},
): McpToolDefinition[] {
  return [
    createPlanGlossaryInstancesTool(client),
    ...(write
      ? [
          createRecordGlossaryReviewTool(client, userId),
          createApplyGlossaryInstancesTool(client, userId),
        ]
      : []),
  ];
}

export { createApplyGlossaryInstancesTool } from './apply-glossary-instances';
export { createPlanGlossaryInstancesTool } from './plan-glossary-instances';
export { createRecordGlossaryReviewTool } from './record-glossary-review';
