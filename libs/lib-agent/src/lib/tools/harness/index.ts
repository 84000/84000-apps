import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';

import { createDeletePolicyTool } from './delete-policy';
import { createPolicyHistoryTool } from './policy-history';
import { createReadPoliciesTool } from './read-policies';
import { createReadPolicyRevisionTool } from './read-policy-revision';
import { createRenamePolicyTool } from './rename-policy';
import { createRestorePolicyTool } from './restore-policy';
import { createWritePolicyTool } from './write-policy';

/**
 * Policy tools, kept apart from the read and write tool sets because their
 * audience is different: the studio route lists write tools for editors only,
 * while policy authorship reaches translators too. Each handler checks its own
 * `harness.*` permission, which is the authoritative gate.
 *
 * `read-policies` and `write-policy` are for the model. The rest are marked
 * app-only for the policy editor, and are registered unconditionally: the
 * stateless route builds a server per request and cannot see whether the
 * client renders MCP Apps.
 *
 * `open-policy-editor` is not here: a server lists it alongside the editor's
 * resource, with `createOpenPolicyEditorTool` and `createPolicyEditorResource`.
 */
export function createHarnessTools(client: DataClient): McpToolDefinition[] {
  return [
    createReadPoliciesTool(client),
    createWritePolicyTool(client),
    createPolicyHistoryTool(client),
    createReadPolicyRevisionTool(client),
    createRestorePolicyTool(client),
    createDeletePolicyTool(client),
    createRenamePolicyTool(client),
  ];
}

export { createReadPoliciesTool } from './read-policies';
export { createWritePolicyTool } from './write-policy';
export { createPolicyHistoryTool } from './policy-history';
export { createReadPolicyRevisionTool } from './read-policy-revision';
export { createRestorePolicyTool } from './restore-policy';
export { createDeletePolicyTool } from './delete-policy';
export { createRenamePolicyTool } from './rename-policy';
export {
  createOpenPolicyEditorTool,
  createPolicyEditorResource,
} from './open-policy-editor';
export {
  MCP_APP_MIME_TYPE,
  POLICY_EDITOR_RESOURCE_URI,
  POLICY_EDITOR_TOOL_META,
  POLICY_TOOL_NAMES,
  authorizePolicyTool,
  policyFailureResult,
} from './shared';
