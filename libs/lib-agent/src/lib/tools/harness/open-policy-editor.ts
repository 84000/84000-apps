import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  isValidPolicyName,
} from '@eightyfourthousand/data-access';
import type { McpResourceDefinition, McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';
import {
  authorizePolicyTool,
  MCP_APP_MIME_TYPE,
  POLICY_EDITOR_RESOURCE_URI,
  POLICY_TOOL_NAMES,
} from './shared';

const inputSchema = {
  name: z
    .string()
    .optional()
    .describe(
      'Policy to open on, e.g. `shared-policies/terminology`. Omit to open on the list of policies.',
    ),
};

/**
 * Model-visible and app-callable, so the app can re-fetch the permissions.
 * Sets the legacy `ui/resourceUri` key too, as ext-apps `registerAppTool` does.
 */
const OPEN_POLICY_EDITOR_TOOL_META = Object.freeze({
  ui: Object.freeze({
    resourceUri: POLICY_EDITOR_RESOURCE_URI,
    visibility: Object.freeze(['model', 'app'] as const),
  }),
  'ui/resourceUri': POLICY_EDITOR_RESOURCE_URI,
});

const FALLBACK_NOTE = `Saves the user makes there are reported back to this conversation when the client supports it, best-effort: read-policies before acting on a policy. If nothing appeared, the client does not display MCP Apps (Claude Code in a terminal, for one): say so, suggest opening it from Claude Desktop or Cowork, and fall back to ${POLICY_TOOL_NAMES.read} and ${POLICY_TOOL_NAMES.write}.`;

/**
 * The policy editor MCP App, as the `ui://` resource `open-policy-editor`
 * links to. `html` is the app's single-file bundle.
 */
export function createPolicyEditorResource(
  html: string,
): McpResourceDefinition {
  return {
    name: 'policy-editor',
    uri: POLICY_EDITOR_RESOURCE_URI,
    title: 'Policy editor',
    description: 'Browse, edit and manage 84000 translation policies.',
    mimeType: MCP_APP_MIME_TYPE,
    text: html,
    _meta: { ui: { prefersBorder: true } },
  };
}

/**
 * Model-visible tool opening the policy editor MCP App, on the named policy or
 * the list. Requires `harness.read`. Returns, as JSON text the app parses,
 * `{ name?, permissions: { read, edit, admin }, message }`; it reads no
 * policy content, which the app fetches itself.
 *
 * Not part of {@link createHarnessTools}: only a server that also serves
 * {@link createPolicyEditorResource} should list it.
 */
export function createOpenPolicyEditorTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: POLICY_TOOL_NAMES.openEditor,
    description:
      'Open the 84000 policy editor, an interactive UI shown to the user in the conversation. ' +
      'Call it when the user wants to browse, edit, see the history of, restore, delete or rename policies in a UI. ' +
      'Pass `name` to open on one policy; omit it to open on the list. ' +
      'Requires harness.read; editing and restoring need harness.edit, deleting and renaming harness.admin.',
    inputSchema,
    annotations: {
      title: 'Open Policy Editor',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: OPEN_POLICY_EDITOR_TOOL_META,
    handler: async ({ name }) => {
      const refused = await authorizePolicyTool(client, 'harness.read');
      if (refused) return refused;

      const [edit, admin] = await Promise.all([
        hasPermission({ client, permission: 'harness.edit' }),
        hasPermission({ client, permission: 'harness.admin' }),
      ]);
      const valid = name !== undefined && isValidPolicyName(name);
      const opened = valid
        ? `The policy editor is open for the user on \`${name}\`.`
        : 'The policy editor is open for the user on the list of policies.';
      const invalid =
        name !== undefined && !valid
          ? ` \`${name}\` is not a valid policy name, so it opened on the list instead.`
          : '';
      const readOnly = edit
        ? ''
        : ' The user lacks harness.edit, so the editor is read-only for them.';

      return jsonResult({
        ...(valid && { name }),
        permissions: { read: true, edit, admin },
        message: `${opened}${invalid}${readOnly} ${FALLBACK_NOTE}`,
      });
    },
  };
}
