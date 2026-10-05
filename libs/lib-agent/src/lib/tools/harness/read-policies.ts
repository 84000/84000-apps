import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { listPolicies, readPolicies } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  POLICY_TOOL_NAMES,
  policyFailureResult,
} from './shared';

const inputSchema = {
  names: z
    .array(z.string())
    .optional()
    .describe(
      'Policy names to resolve, e.g. ["translator-guidelines/IV.B-proper-names"]. Omit to list every policy name without its content.',
    ),
};

/**
 * Read tool that resolves policy names to their current markdown, each with the
 * `version` a later write is checked against. Requires `harness.read`.
 *
 * Called with no names it lists what is available, so a session can discover
 * the tree before deciding what to load; called with names it returns content.
 * Both come from the bucket on every call — the point of moving policies out of
 * the plugin is that a session sees the current text, not the text as of the
 * last release.
 */
export function createReadPoliciesTool(client: DataClient): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.read,
    description:
      "Read 84000's translation policies — house style, text-critical practice, and the rest of the governing guidance — as they stand right now. Call with no arguments to list the available policy names; call with names to get their markdown, each with a `version` to pass to write-policy as `expectedVersion` when you edit it. Read the policies your task depends on at the start of a session rather than relying on remembered guidance.",
    inputSchema,
    annotations: {
      title: 'Read Policies',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async ({ names }) => {
      const refused = await authorizePolicyTool(client, 'harness.read');
      if (refused) return refused;

      if (!names?.length) {
        const available = await listPolicies({ client });
        if (!available) {
          return policyFailureResult({
            ok: false,
            reason: 'error',
            message: 'Could not list the policies.',
          });
        }
        return jsonResult({ policies: available });
      }

      const { policies, missing } = await readPolicies({ client, names });
      if (!policies.length) {
        return policyFailureResult(
          { ok: false, reason: 'not-found' },
          `No policy matched ${missing.join(', ')}. Call this tool with no arguments to list the available names.`,
        );
      }

      return jsonResult({ policies, ...(missing.length ? { missing } : {}) });
    },
  };
}
