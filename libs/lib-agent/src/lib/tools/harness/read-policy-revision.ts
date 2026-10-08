import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { readPolicyRevision } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  APP_ONLY_NOTE,
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
 * Requires `harness.read`. Anything that is not an archived revision —
 * including a live policy's key — or that is not there is `not-found`; a
 * storage failure is `error`, so the app can retry instead of showing the
 * revision as gone.
 */
export function createReadPolicyRevisionTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.readRevision,
    description: `Read one archived revision of an 84000 translation policy by its archive key. ${APP_ONLY_NOTE}`,
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

      const result = await readPolicyRevision({ client, path });
      if (!result.ok) return policyFailureResult(result);

      return jsonResult({ revision: result.revision, content: result.content });
    },
  };
}
