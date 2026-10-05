import { z } from 'zod';
import type {
  DataClient,
  PolicyFailure,
} from '@eightyfourthousand/data-access';
import { hasPermission, writePolicy } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

const inputSchema = {
  name: z
    .string()
    .describe(
      'Policy name, e.g. "translator-guidelines/IV.B-proper-names". A name that does not exist yet creates a new policy.',
    ),
  content: z
    .string()
    .describe(
      'The full markdown of the policy. This replaces the whole file rather than patching it.',
    ),
};

/** Why a write did not happen, in terms a model can relay to the user. */
const failureMessage = (name: string, failure: PolicyFailure) => {
  switch (failure.reason) {
    case 'conflict':
      return `${name} changed since it was read; nothing was written. Read it again and reapply the change.`;
    case 'not-found':
      return `${name} no longer exists; nothing was written.`;
    case 'exists':
      return `${name} already exists; nothing was written.`;
    case 'forbidden':
      return `The current account is not allowed to write ${name}; nothing was written.`;
    case 'error':
      return failure.message;
  }
};

/**
 * Write tool that replaces a policy's markdown. Requires `harness.edit`.
 *
 * The previous revision is copied into the archive first, and the write is
 * abandoned if that copy fails — an edit is only safe to make because the text
 * it replaced is recoverable.
 */
export function createWritePolicyTool(client: DataClient): McpToolDefinition {
  return {
    name: 'write-policy',
    description:
      "Replace an 84000 translation policy with new markdown. The whole file is replaced, so send the complete text. The previous revision is archived automatically. Show the user the change and get their agreement before calling this — the edit is live for every translator's next session.",
    inputSchema,
    annotations: {
      title: 'Write Policy',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async ({ name, content }) => {
      const allowed = await hasPermission({
        client,
        permission: 'harness.edit',
      });
      if (!allowed) {
        return errorResult(
          'This tool requires the harness.edit permission on the current account.',
        );
      }

      const result = await writePolicy({ client, name, content });
      if (!result.ok) {
        return errorResult(failureMessage(name, result));
      }

      return jsonResult({
        written: true,
        name,
        created: result.created,
        archivedPath: result.archivedPath,
      });
    },
  };
}
