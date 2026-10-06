import type { PolicyVersion } from './policy-source.contract';

/** A change the user made in the editor, as reported to the conversation. */
export type PolicyChange =
  | { kind: 'saved'; name: string; version: PolicyVersion }
  | { kind: 'created'; name: string; version: PolicyVersion }
  | {
      kind: 'restored';
      name: string;
      version: PolicyVersion;
      revisionPath: string;
    }
  | { kind: 'deleted'; name: string; archivedPath: string }
  | { kind: 'renamed'; from: string; to: string; archivedPath: string };

type TextContent = { type: 'text'; text: string };

/** The part of the ext-apps `App` that updates the model context. */
export interface ModelContextApp {
  updateModelContext(params: { content: TextContent[] }): Promise<unknown>;
}

/** The part of the ext-apps `App` that posts a message to the conversation. */
export interface MessageApp {
  sendMessage(params: {
    role: 'user';
    content: TextContent[];
  }): Promise<{ isError?: boolean }>;
}

const reread = (name: string) =>
  `Re-read "${name}" with read-policies before relying on it.`;

/** What changed, in a sentence or two. Never includes policy content. */
export function describePolicyChange(change: PolicyChange): string {
  const prefix = 'Policy editor:';
  switch (change.kind) {
    case 'saved':
      return `${prefix} "${change.name}" was saved (new version ${change.version}). ${reread(change.name)}`;
    case 'created':
      return `${prefix} "${change.name}" was created (version ${change.version}). ${reread(change.name)}`;
    case 'restored':
      return `${prefix} "${change.name}" was restored from ${change.revisionPath} (new version ${change.version}). ${reread(change.name)}`;
    case 'deleted':
      return `${prefix} "${change.name}" was deleted; its last text is archived at ${change.archivedPath}. Do not rely on an earlier read of it.`;
    case 'renamed':
      return `${prefix} "${change.from}" was renamed to "${change.to}"; the old text is archived at ${change.archivedPath}. ${reread(change.to)}`;
  }
}

const content = (change: PolicyChange): TextContent[] => [
  { type: 'text', text: describePolicyChange(change) },
];

/**
 * Tells the model about a change through the host's model context, without a
 * visible message. Best-effort: some hosts ignore it, and a host may keep only
 * the latest update. Never throws; resolves `true` when the host accepted it.
 */
export async function reportPolicyChange(
  app: ModelContextApp,
  change: PolicyChange,
): Promise<boolean> {
  try {
    await app.updateModelContext({ content: content(change) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Posts a visible message about a change into the conversation. Only for a
 * user-clicked "Tell Claude" button: never call it automatically, because
 * hosts show a trust warning on every app message. Resolves `true` when sent.
 */
export async function tellClaude(
  app: MessageApp,
  change: PolicyChange,
): Promise<boolean> {
  try {
    const result = await app.sendMessage({
      role: 'user',
      content: content(change),
    });
    return result.isError !== true;
  } catch {
    return false;
  }
}
