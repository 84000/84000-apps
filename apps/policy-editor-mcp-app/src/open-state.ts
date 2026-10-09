import type { PolicyPermissions } from '@eightyfourthousand/lib-editing/policy-editor';
import { POLICY_TOOL_NAMES } from './tool-names';
import { isRecord, parseToolResult, type ToolCaller } from './tool-result';

/** What the editor opens on: an optional policy name and the user's permissions. */
export type OpenState = { name?: string; permissions: PolicyPermissions };

const noPermissions = (): PolicyPermissions => ({
  read: false,
  edit: false,
  admin: false,
});

/** Permissions from a tool result, all `false` unless every flag is a boolean. */
const toPermissions = (value: unknown): PolicyPermissions =>
  isRecord(value) &&
  typeof value.read === 'boolean' &&
  typeof value.edit === 'boolean' &&
  typeof value.admin === 'boolean'
    ? { read: value.read, edit: value.edit, admin: value.admin }
    : noPermissions();

const toName = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * The open state in an `open-policy-editor` result, read from its `content`
 * text. `undefined` for an error or a result without JSON.
 */
export function parseOpenState(result: unknown): OpenState | undefined {
  const parsed = parseToolResult(result);
  if (!parsed.ok || parsed.isError) return undefined;
  const name = toName(parsed.body.name);
  return {
    ...(name ? { name } : {}),
    permissions: toPermissions(parsed.body.permissions),
  };
}

/**
 * Resolves the editor's open state. Feed it the host's tool input and tool
 * result as they arrive; `resolve` waits up to `timeoutMs` for a usable
 * result, then calls `open-policy-editor` itself. A parsed result's `name` is
 * trusted as is: the server omits it when the input name was missing or
 * invalid. If the fallback fails too, the state has the input name and no
 * permissions.
 */
export function createOpenState(
  caller: ToolCaller,
  { timeoutMs = 3000 }: { timeoutMs?: number } = {},
) {
  let inputName: string | undefined;
  let delivered: OpenState | undefined;
  let onDelivered: ((state: OpenState) => void) | undefined;
  let resolving: Promise<OpenState> | undefined;

  const waitForResult = () =>
    new Promise<OpenState | undefined>((settle) => {
      const timer = setTimeout(() => settle(undefined), timeoutMs);
      onDelivered = (arrived) => {
        clearTimeout(timer);
        settle(arrived);
      };
    });

  const fetchState = async (): Promise<OpenState> => {
    try {
      const result = await caller.callServerTool({
        name: POLICY_TOOL_NAMES.openEditor,
        arguments: inputName ? { name: inputName } : {},
      });
      const state = parseOpenState(result);
      if (state) return state;
    } catch {
      // Fall through to the closed state.
    }
    return {
      ...(inputName ? { name: inputName } : {}),
      permissions: noPermissions(),
    };
  };

  return {
    /** The `arguments` of the host's tool-input notification. */
    toolInput(args: unknown) {
      if (isRecord(args)) inputName = toName(args.name) ?? inputName;
    },

    /** The host's tool-result notification for `open-policy-editor`. */
    toolResult(result: unknown) {
      const state = parseOpenState(result);
      if (!state || delivered) return;
      delivered = state;
      onDelivered?.(state);
    },

    /** The open state; every call shares the first call's resolution. */
    resolve(): Promise<OpenState> {
      resolving ??= (async () =>
        delivered ?? (await waitForResult()) ?? fetchState())();
      return resolving;
    },
  };
}
