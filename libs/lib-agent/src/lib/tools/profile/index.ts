import { z } from 'zod';
import {
  addMyProfileTag,
  getMyAccess,
  getMyProfile,
  PROFILE_TAGS,
  type DataClient,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { errorResult, jsonResult } from '../read/util';

/** Names of the profile tools. */
export const PROFILE_TOOL_NAMES = {
  get: 'get-my-profile',
  addTag: 'add-profile-tag',
} as const;

const READ_FAILED =
  'Your 84000 profile could not be read right now. Try again shortly.';

const TAG_FAILURES = {
  'not-found':
    'This account has no 84000 profile to tag, so nothing was saved. Let the user know and suggest they contact the 84000 team.',
  conflict:
    'The profile kept changing while the tag was being saved, so it may not have been added. Try once more.',
  error: 'The tag could not be saved right now. Try again shortly.',
} as const;

/**
 * `get-my-profile`: the caller's name, stored role, effective permissions and
 * profile tags. The role and permissions come from the database, not the
 * token, so a `manager` is reported as one.
 */
export function createGetMyProfileTool(
  client: DataClient,
  userId: string,
): McpToolDefinition {
  return {
    name: PROFILE_TOOL_NAMES.get,
    description:
      "Read the signed-in user's 84000 profile: their name, 84000 role, the permissions that role and any individual grants give them, and their profile tags (for example `harness.onboarding.completed`). Use it to tailor guidance to the user's role. It describes the user; it does not grant anything.",
    inputSchema: {},
    annotations: {
      title: 'Get My Profile',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async () => {
      const [profile, access] = await Promise.all([
        getMyProfile({ client, userId }),
        getMyAccess({ client }),
      ]);
      if (!access) return errorResult(READ_FAILED);

      return jsonResult({
        name: profile?.fullName ?? profile?.username ?? null,
        role: access.role,
        permissions: access.permissions,
        tags: profile?.tags ?? [],
      });
    },
  };
}

/**
 * `add-profile-tag`: adds one allowlisted tag to the caller's own profile.
 * Idempotent. Tags are self-asserted, so nothing may authorize on them.
 */
export function createAddProfileTagTool(
  client: DataClient,
  userId: string,
): McpToolDefinition {
  return {
    name: PROFILE_TOOL_NAMES.addTag,
    description:
      'Add a tag to the signed-in user\'s own 84000 profile. `harness.onboarding.completed` records that the user finished 84000 onboarding or said they do not want it; do not set it when they only say "not now". Adding a tag the profile already has changes nothing.',
    inputSchema: {
      tag: z.enum(PROFILE_TAGS).describe('The tag to add.'),
    },
    annotations: {
      title: 'Add Profile Tag',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (args) => {
      const { tag } = args as { tag: string };
      // The SDK validates against the schema first; this keeps the allowlist
      // authoritative for any caller that bypasses it.
      if (!(PROFILE_TAGS as readonly string[]).includes(tag)) {
        return errorResult(
          `Unknown tag "${tag}". Allowed tags: ${PROFILE_TAGS.join(', ')}.`,
        );
      }

      const result = await addMyProfileTag({ client, userId, tag });
      if (!result.ok) return errorResult(TAG_FAILURES[result.reason]);

      return jsonResult({
        ok: true,
        tag,
        added: result.added,
        tags: result.tags,
      });
    },
  };
}

/**
 * Profile tools, listed for every authenticated user. Each acts only on the
 * caller's own row, identified by the verified `userId`, never by the agent.
 */
export function createProfileTools(
  client: DataClient,
  userId: string,
): McpToolDefinition[] {
  return [
    createGetMyProfileTool(client, userId),
    createAddProfileTagTool(client, userId),
  ];
}
