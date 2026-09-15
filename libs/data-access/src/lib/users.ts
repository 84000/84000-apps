import {
  type DataClient,
  type UserInfo,
  type UserInfoDTO,
  userInfoFromDTO,
} from './types';

/**
 * Enough of each named user to display them, keyed by auth user id.
 *
 * Read through the `get_user_info` definer function, not `user_profiles`: the
 * table's only SELECT policy is self-read, so a direct select through the
 * requesting user's client returns the caller's own row and nothing else. The
 * function checks `editor.read` itself and returns identity columns only.
 *
 * Shaped for a DataLoader: one call per batch of ids.
 */
export const getUserInfo = async ({
  client,
  ids,
}: {
  client: DataClient;
  ids: readonly string[];
}): Promise<Map<string, UserInfo>> => {
  const usersById = new Map<string, UserInfo>();

  if (ids.length === 0) {
    return usersById;
  }

  const { data, error } = await client.rpc('get_user_info', {
    p_ids: [...new Set(ids)],
  });

  if (error) {
    // Includes the permission denial the function raises for a caller without
    // `editor.read`. An empty map renders every user as unknown, which is the
    // right outcome for a reader who should not be seeing names.
    console.error('Error resolving user info:', error);
    return usersById;
  }

  for (const row of (data ?? []) as UserInfoDTO[]) {
    usersById.set(row.id, userInfoFromDTO(row));
  }

  return usersById;
};
