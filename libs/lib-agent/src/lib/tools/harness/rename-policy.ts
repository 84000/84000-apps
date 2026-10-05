import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { renamePolicy } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  POLICY_EDITOR_TOOL_META,
  POLICY_TOOL_NAMES,
  policyFailureResult,
} from './shared';

const inputSchema = {
  from: z.string().describe('Current policy name.'),
  to: z.string().describe('New policy name; must not exist yet.'),
  expectedVersion: z
    .string()
    .optional()
    .describe(
      'The version of the policy as last read; the rename is refused if it changed since.',
    ),
};

/**
 * App-only tool renaming a policy, returning `{ ok: true, archivedPath }` or a
 * `PolicyFailure` (`exists` when the new name is taken). Requires
 * `harness.admin`. The history stays under the old name.
 */
export function createRenamePolicyTool(client: DataClient): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.rename,
    description:
      'Rename an 84000 translation policy. The old name is archived and removed; its history stays under the old name. Used by the policy editor.',
    inputSchema,
    annotations: {
      title: 'Rename Policy',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: POLICY_EDITOR_TOOL_META,
    handler: async ({ from, to, expectedVersion }) => {
      const refused = await authorizePolicyTool(client, 'harness.admin');
      if (refused) return refused;

      const result = await renamePolicy({ client, from, to, expectedVersion });
      return result.ok ? jsonResult(result) : policyFailureResult(result);
    },
  };
}
