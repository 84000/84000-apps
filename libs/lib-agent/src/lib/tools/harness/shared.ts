import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import type {
  DataClient,
  PolicyFailure,
  UserPermission,
} from '@eightyfourthousand/data-access';
import { hasPermission } from '@eightyfourthousand/data-access';
import { jsonResult } from '../read/util';

/**
 * The MCP App resource that renders the policy editor. A contract with the
 * server that serves it: the app-only policy tools name it in `_meta.ui`.
 */
export const POLICY_EDITOR_RESOURCE_URI = 'ui://policy-editor/app.html';

/** Names of the policy tools, for clients that call them by name. */
export const POLICY_TOOL_NAMES = {
  read: 'read-policies',
  write: 'write-policy',
  history: 'policy-history',
  readRevision: 'read-policy-revision',
  restore: 'restore-policy',
  delete: 'delete-policy',
  rename: 'rename-policy',
} as const;

/**
 * `_meta` for a tool only the policy editor calls. Hosts that honour MCP Apps
 * visibility hide it from the model; it is not access control, so every
 * handler still runs {@link authorizePolicyTool}.
 */
export const POLICY_EDITOR_TOOL_META = {
  ui: { resourceUri: POLICY_EDITOR_RESOURCE_URI, visibility: ['app'] },
};

/**
 * A policy failure as a tool result: the `PolicyFailure` object as JSON, with
 * `isError` set. `message` adds a human-readable explanation for the model on
 * the reasons that do not carry one.
 */
export function policyFailureResult(
  failure: PolicyFailure,
  message?: string,
): CallToolResult {
  const body =
    message && failure.reason !== 'error' ? { ...failure, message } : failure;
  return { ...jsonResult(body), isError: true };
}

/**
 * The one permission gate for the policy tools: `null` when the current
 * account holds `permission`, otherwise the `forbidden` result to return.
 */
export async function authorizePolicyTool(
  client: DataClient,
  permission: UserPermission,
): Promise<CallToolResult | null> {
  if (await hasPermission({ client, permission })) return null;
  return policyFailureResult(
    { ok: false, reason: 'forbidden' },
    `This tool requires the ${permission} permission on the current account.`,
  );
}
