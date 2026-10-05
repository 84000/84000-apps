import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { restorePolicy } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  POLICY_EDITOR_TOOL_META,
  POLICY_TOOL_NAMES,
  policyFailureResult,
} from './shared';

const inputSchema = {
  name: z.string().describe('Policy name to restore the revision onto.'),
  revisionPath: z
    .string()
    .describe('Archive key of the revision to restore, from policy-history.'),
  expectedVersion: z
    .string()
    .optional()
    .describe(
      'The version of the policy as last read; the restore is refused if it changed since.',
    ),
};

/**
 * App-only tool restoring an archived revision as a new write, returning the
 * `PolicyWriteResult`. Requires `harness.edit`. The current text is archived
 * first and the archive itself is never modified, so a restore is undoable.
 */
export function createRestorePolicyTool(client: DataClient): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.restore,
    description:
      'Restore an archived revision of an 84000 translation policy as its current text. The text it replaces is archived first. Used by the policy editor.',
    inputSchema,
    annotations: {
      title: 'Restore Policy',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    _meta: POLICY_EDITOR_TOOL_META,
    handler: async ({ name, revisionPath, expectedVersion }) => {
      const refused = await authorizePolicyTool(client, 'harness.edit');
      if (refused) return refused;

      const result = await restorePolicy({
        client,
        name,
        revisionPath,
        expectedVersion,
      });
      return result.ok ? jsonResult(result) : policyFailureResult(result);
    },
  };
}
