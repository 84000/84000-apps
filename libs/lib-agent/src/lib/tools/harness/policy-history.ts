import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  isValidPolicyName,
  listPolicyRevisions,
} from '@eightyfourthousand/data-access';
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
  name: z
    .string()
    .describe('Policy name, e.g. "translator-guidelines/IV.B-proper-names".'),
};

/**
 * App-only tool listing a policy's archived revisions, newest first, as
 * `{ revisions }`. Requires `harness.read`. A failed listing is an `error`,
 * never an empty history, and so is an invalid name, with a message saying so.
 */
export function createPolicyHistoryTool(client: DataClient): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.history,
    description: `List the archived revisions of an 84000 translation policy, newest first. ${APP_ONLY_NOTE}`,
    inputSchema,
    annotations: {
      title: 'Policy History',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: POLICY_EDITOR_TOOL_META,
    handler: async ({ name }) => {
      const refused = await authorizePolicyTool(client, 'harness.read');
      if (refused) return refused;

      const revisions = await listPolicyRevisions({ client, name });
      if (!revisions) {
        return policyFailureResult({
          ok: false,
          reason: 'error',
          // The listing also returns undefined for a name it refuses to
          // look up, which is not a storage failure.
          message: isValidPolicyName(name)
            ? `Could not list the revisions of ${name}.`
            : `${name} is not a valid policy name; use a "<group>/<policy>" name from read-policies.`,
        });
      }

      return jsonResult({ revisions });
    },
  };
}
