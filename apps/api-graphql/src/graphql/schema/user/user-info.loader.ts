import DataLoader from 'dataloader';
import {
  getUserInfo,
  unknownUser,
  type DataClient,
  type UserInfo,
} from '@eightyfourthousand/data-access';

/**
 * Creates a DataLoader for user identities, keyed by auth user id.
 *
 * Whatever names a user — a comment author, a mention, an assignment — resolves
 * through here, so a page naming the same few people many times costs one read.
 * It takes no `ContentSource` because profiles are not versioned content.
 *
 * An id with no profile — a deleted account, or a caller without `editor.read`
 * for whom the whole batch comes back empty — yields a generically named user
 * rather than null, so a non-null author field holds.
 */
export function createUserInfoLoader(supabase: DataClient) {
  return new DataLoader<string, UserInfo>(async (ids) => {
    const usersById = await getUserInfo({ client: supabase, ids });
    return ids.map((id) => usersById.get(id) ?? unknownUser(id));
  });
}
