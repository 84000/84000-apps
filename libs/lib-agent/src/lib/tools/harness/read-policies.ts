import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  listPolicies,
  readPolicies,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

const inputSchema = {
  names: z
    .array(z.string())
    .optional()
    .describe(
      'Policy names to resolve, e.g. ["translator-guidelines/IV.B-proper-names"]. Omit to list every policy name without its content.',
    ),
};

/**
 * Read tool that resolves policy names to their current markdown. Requires
 * `harness.read`.
 *
 * Called with no names it lists what is available, so a session can discover
 * the tree before deciding what to load; called with names it returns content.
 * Both come from the bucket on every call — the point of moving policies out of
 * the plugin is that a session sees the current text, not the text as of the
 * last release.
 */
export function createReadPoliciesTool(client: DataClient): McpToolDefinition {
  return {
    name: 'read-policies',
    description:
      "Read 84000's translation policies — house style, text-critical practice, and the rest of the governing guidance — as they stand right now. Call with no arguments to list the available policy names; call with names to get their markdown. Read the policies your task depends on at the start of a session rather than relying on remembered guidance.",
    inputSchema,
    annotations: {
      title: 'Read Policies',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async ({ names }) => {
      const allowed = await hasPermission({
        client,
        permission: 'harness.read',
      });
      if (!allowed) {
        return errorResult(
          'This tool requires the harness.read permission on the current account.',
        );
      }

      if (!names?.length) {
        const available = await listPolicies({ client });
        if (!available) {
          return errorResult('Could not list the policies.');
        }
        return jsonResult({ policies: available });
      }

      const { policies, missing } = await readPolicies({ client, names });
      if (!policies.length) {
        return errorResult(
          `No policy matched ${missing.join(', ')}. Call this tool with no arguments to list the available names.`,
        );
      }

      return jsonResult({ policies, ...(missing.length ? { missing } : {}) });
    },
  };
}
