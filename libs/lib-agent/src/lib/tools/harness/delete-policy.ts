import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { deletePolicy } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  POLICY_EDITOR_TOOL_META,
  POLICY_TOOL_NAMES,
  policyFailureResult,
} from './shared';

const inputSchema = {
  name: z.string().describe('Policy name to delete.'),
  expectedVersion: z
    .string()
    .optional()
    .describe(
      'The version of the policy as last read; the delete is refused if it changed since.',
    ),
};

/**
 * App-only tool deleting a live policy after archiving it, returning
 * `{ ok: true, archivedPath }` or a `PolicyFailure`. Requires `harness.admin`.
 */
export function createDeletePolicyTool(client: DataClient): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.delete,
    description:
      'Delete an 84000 translation policy. Its last text is archived first. Used by the policy editor.',
    inputSchema,
    annotations: {
      title: 'Delete Policy',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: POLICY_EDITOR_TOOL_META,
    handler: async ({ name, expectedVersion }) => {
      const refused = await authorizePolicyTool(client, 'harness.admin');
      if (refused) return refused;

      const result = await deletePolicy({ client, name, expectedVersion });
      return result.ok ? jsonResult(result) : policyFailureResult(result);
    },
  };
}
