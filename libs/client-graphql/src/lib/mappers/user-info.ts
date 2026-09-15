import type { UserInfo } from '@eightyfourthousand/data-access';

/**
 * GraphQL UserInfo type
 */
export type GraphQLUserInfo = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

/**
 * Convert a GraphQL user to the internal UserInfo type
 */
export function userInfoFromGraphQL(user: GraphQLUserInfo): UserInfo {
  return {
    id: user.id,
    displayName: user.displayName,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
  };
}
