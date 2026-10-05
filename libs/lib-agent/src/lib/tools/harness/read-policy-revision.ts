import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { readPolicyRevision } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  POLICY_EDITOR_TOOL_META,
  POLICY_TOOL_NAMES,
  policyFailureResult,
} from './shared';

const inputSchema = {
  path: z
    .string()
    .describe(
      'Archive key of the revision, as returned in policy-history, e.g. "archive/a/b.md/20260908T193000Z.md".',
    ),
};

/**
 * App-only tool reading one archived revision as `{ revision, content }`.
 * Requires `harness.read`. Anything that is not a readable archived revision —
 * including a live policy's key — is `not-found`.
 */
export function createReadPolicyRevisionTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.readRevision,
    description:
      'Read one archived revision of an 84000 translation policy by its archive key. Used by the policy editor.',
    inputSchema,
    annotations: {
      title: 'Read Policy Revision',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: POLICY_EDITOR_TOOL_META,
    handler: async ({ path }) => {
      const refused = await authorizePolicyTool(client, 'harness.read');
      if (refused) return refused;

      const revision = await readPolicyRevision({ client, path });
      if (!revision) {
        return policyFailureResult({ ok: false, reason: 'not-found' });
      }

      return jsonResult(revision);
    },
  };
}
