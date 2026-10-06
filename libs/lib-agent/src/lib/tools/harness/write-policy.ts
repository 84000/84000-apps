import { z } from 'zod';
import type {
  DataClient,
  PolicyFailure,
} from '@eightyfourthousand/data-access';
import { writePolicy } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  POLICY_TOOL_NAMES,
  policyFailureResult,
} from './shared';

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
  expectedVersion: z
    .string()
    .optional()
    .describe(
      'The `version` from the read-policies result you are editing; the write is refused if the policy changed since.',
    ),
};

/** Why a write did not happen, in terms a model can relay to the user. */
const failureMessage = (name: string, failure: PolicyFailure) => {
  switch (failure.reason) {
    case 'conflict':
      return `${name} changed since it was read; nothing was written. \`current\` is the live text and its version: show the user how it differs from what they meant to write, and once they confirm, retry with \`current.version\`.`;
    case 'not-found':
      return `${name} no longer exists (it may have been deleted or renamed); nothing was written.`;
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
 * it replaced is recoverable. With `expectedVersion` the write is also refused
 * when the policy changed since it was read; the `conflict` carries the live
 * text so the change can be reconciled rather than lost.
 */
export function createWritePolicyTool(client: DataClient): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.write,
    description:
      "Replace an 84000 translation policy with new markdown. The whole file is replaced, so send the complete text. The previous revision is archived automatically. Pass the `version` you read as `expectedVersion` so a concurrent edit is not overwritten. Show the user the change and get their agreement before calling this — the edit is live for every translator's next session.",
    inputSchema,
    annotations: {
      title: 'Write Policy',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async ({ name, content, expectedVersion }) => {
      const refused = await authorizePolicyTool(client, 'harness.edit');
      if (refused) return refused;

      const result = await writePolicy({
        client,
        name,
        content,
        expectedVersion,
      });
      if (!result.ok) {
        return policyFailureResult(result, failureMessage(name, result));
      }

      // `written` and `name` predate the PolicyWriteResult shape; kept so
      // existing callers keep working.
      return jsonResult({ ...result, written: true, name });
    },
  };
}
