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

/** The MIME type MCP Apps hosts expect on a `ui://` HTML resource. */
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

/** Names of the policy tools, for clients that call them by name. */
export const POLICY_TOOL_NAMES = {
  read: 'read-policies',
  write: 'write-policy',
  history: 'policy-history',
  readRevision: 'read-policy-revision',
  restore: 'restore-policy',
  delete: 'delete-policy',
  rename: 'rename-policy',
  /**
   * Model-visible; opens the policy editor app. Listed only by a server that
   * also serves its resource, so it is not in `createHarnessTools`.
   */
  openEditor: 'open-policy-editor',
} as const;

/** Appended to the description of every tool only the policy editor calls. */
export const APP_ONLY_NOTE =
  'Called only by the policy editor app; do not call it from chat.';

/** Added to the destructive app-only tools, so a model knows where to send the user. */
export const OPEN_EDITOR_NOTE = `To delete or rename a policy, the user opens the editor with ${POLICY_TOOL_NAMES.openEditor}.`;

/**
 * `_meta` for a tool only the policy editor calls. Hosts that honour MCP Apps
 * visibility hide it from the model; it is not access control, so every
 * handler still runs {@link authorizePolicyTool}.
 */
export const POLICY_EDITOR_TOOL_META = Object.freeze({
  ui: Object.freeze({
    resourceUri: POLICY_EDITOR_RESOURCE_URI,
    visibility: Object.freeze(['app'] as const),
  }),
});

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
