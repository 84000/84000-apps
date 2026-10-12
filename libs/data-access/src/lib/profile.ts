import {
  type DataClient,
  type UserAccess,
  type UserPermission,
  type UserProfile,
  type UserProfileDTO,
  type UserRole,
  userProfileFromDTO,
} from './types';

const PROFILE_COLUMNS = 'id, username, full_name, avatar_url, tags';

/**
 * The caller's own `user_profiles` row, or `null` when it cannot be read.
 *
 * `userId` must be the verified id of the user behind `client`: the table's
 * only SELECT policy is self-read, so any other id returns nothing.
 */
export const getMyProfile = async ({
  client,
  userId,
}: {
  client: DataClient;
  userId: string;
}): Promise<UserProfile | null> => {
  const { data, error } = await client
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error(`Failed to read user profile: ${error.message}`);
    return null;
  }
  if (!data) return null;

  return userProfileFromDTO(data as UserProfileDTO);
};

/**
 * The caller's stored role and effective permissions, or `null` when they
 * cannot be read.
 *
 * Read through the `get_my_access` definer function: `user_roles` is not
 * readable by `authenticated`, and the JWT's `user_role` claim is as stale as
 * the token. Informational only — gate on `hasPermission`, never on this.
 */
export const getMyAccess = async ({
  client,
}: {
  client: DataClient;
}): Promise<UserAccess | null> => {
  const { data, error } = await client.rpc('get_my_access');

  if (error) {
    console.error(`Failed to read user access: ${error.message}`);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    { role?: string | null; permissions?: string[] | null } | null | undefined;
  if (!row?.role) return null;

  return {
    role: row.role as UserRole,
    permissions: (Array.isArray(row.permissions)
      ? row.permissions
      : []) as UserPermission[],
  };
};

export type AddProfileTagResult =
  | { ok: true; tags: string[]; added: boolean }
  | { ok: false; reason: 'not-found' | 'conflict' | 'error' };

/** Compare-and-swap attempts before giving up on a concurrently changing row. */
const MAX_ATTEMPTS = 3;

/**
 * Adds one tag to the caller's own profile. Idempotent: a tag already present
 * leaves the row untouched and reports `added: false`.
 *
 * PostgREST cannot append to an array in place, so this reads the tags and
 * writes them back only if they are still what it read (a compare-and-swap on
 * the whole array), retrying a few times if another write got there first.
 * That keeps a concurrent add of a different tag from being lost.
 *
 * An UPDATE that RLS filters out matches nothing and raises nothing, so a
 * write that returns no row is re-read rather than assumed to have landed.
 *
 * The caller decides which tags are allowed; see `PROFILE_TAGS`.
 */
export const addMyProfileTag = async ({
  client,
  userId,
  tag,
}: {
  client: DataClient;
  userId: string;
  tag: string;
}): Promise<AddProfileTagResult> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await client
      .from('user_profiles')
      .select('tags')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(`Failed to read profile tags: ${error.message}`);
      return { ok: false, reason: 'error' };
    }
    if (!data) return { ok: false, reason: 'not-found' };

    const current: string[] = Array.isArray(data.tags) ? data.tags : [];
    if (current.includes(tag)) {
      return { ok: true, tags: current, added: false };
    }

    const next = [...current, tag];
    const { data: updated, error: updateError } = await client
      .from('user_profiles')
      .update({ tags: next, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('tags', toPgArrayLiteral(current))
      .select('tags');

    if (updateError) {
      console.error(`Failed to add profile tag: ${updateError.message}`);
      return { ok: false, reason: 'error' };
    }
    if (updated && updated.length > 0) {
      const tags = updated[0].tags;
      return { ok: true, tags: Array.isArray(tags) ? tags : next, added: true };
    }
    // No row matched: the tags changed under us, or RLS hid the row. Re-read
    // and try again; a hidden row shows up as `not-found` on the next pass.
  }

  return { ok: false, reason: 'conflict' };
};

/**
 * A text[] as a Postgres array literal, for an `eq` filter on the whole array.
 * Every element is quoted, with `"` and `\` escaped, so a tag holding a comma
 * or brace cannot change the array's shape.
 */
export const toPgArrayLiteral = (values: readonly string[]): string =>
  `{${values
    .map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')}}`;
