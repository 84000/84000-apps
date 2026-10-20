import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { getMyProfile, type DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { PROFILE_TOOL_NAMES } from './index';

/** The tag that marks a user as onboarded. */
export const ONBOARDING_COMPLETED_TAG = 'harness.onboarding.completed';

/**
 * Appended to studio tool results while the caller is not onboarded. Short and
 * identical every time, so it costs little until the tag is set. It repeats on
 * every result, so it asks for one offer a session, not one per result.
 */
export const ONBOARDING_NOTE =
  "This user hasn't completed 84000 onboarding. If you haven't offered it this session, offer to run the onboarding skill; if they decline or defer, don't raise it again.";

/**
 * Whether the caller still needs onboarding, read at most once per request and
 * only when a tool is called or the session is initialized. An unreadable
 * profile counts as no: a missing offer is cheaper than nagging an onboarded
 * user.
 */
export function onboardingCheck(
  client: DataClient,
  userId: string,
): () => Promise<boolean> {
  let pending: Promise<boolean> | undefined;
  return () => {
    pending ??= getMyProfile({ client, userId }).then(
      (profile) =>
        profile !== null && !profile.tags.includes(ONBOARDING_COMPLETED_TAG),
      () => false,
    );
    return pending;
  };
}

/** Tools that report or change the tag themselves, or that only an app calls. */
const isExempt = (tool: McpToolDefinition): boolean => {
  if (
    tool.name === PROFILE_TOOL_NAMES.get ||
    tool.name === PROFILE_TOOL_NAMES.addTag
  ) {
    return true;
  }
  const visibility = (
    tool._meta?.['ui'] as { visibility?: unknown } | undefined
  )?.visibility;
  return (
    Array.isArray(visibility) &&
    visibility.length > 0 &&
    !visibility.includes('model')
  );
};

/**
 * Wraps each tool so its result carries {@link ONBOARDING_NOTE} while
 * `needsOnboarding` says so. The profile tools and app-only tools are left
 * alone.
 */
export function withOnboardingNote(
  tools: McpToolDefinition[],
  needsOnboarding: () => Promise<boolean>,
): McpToolDefinition[] {
  return tools.map((tool) => {
    if (isExempt(tool)) return tool;
    const handler = tool.handler as (
      ...args: unknown[]
    ) => CallToolResult | Promise<CallToolResult>;
    return {
      ...tool,
      handler: (async (...args: unknown[]) => {
        const [result, needed] = await Promise.all([
          handler(...args),
          needsOnboarding(),
        ]);
        if (!needed) return result;
        return {
          ...result,
          content: [
            ...(result.content ?? []),
            { type: 'text', text: ONBOARDING_NOTE },
          ],
        };
      }) as McpToolDefinition['handler'],
    };
  });
}
