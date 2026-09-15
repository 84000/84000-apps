export type UserRole = 'reader' | 'scholar' | 'translator' | 'editor' | 'admin';
export type UserClaims = {
  role: UserRole;
};

export const USER_PERMISIONS = [
  'projects.read',
  'projects.edit',
  'projects.admin',
  'editor.read',
  'editor.edit',
  'editor.admin',
  'harness.read',
  'harness.edit',
  'harness.admin',
];

export type UserPermission = (typeof USER_PERMISIONS)[number];

/**
 * Enough of a user to name them on screen. Identity only — never an email, and
 * never the unrelated profile columns such as `subscriptions`.
 */
export type UserInfo = {
  id: string;
  /** Never empty — see `userInfoFromDTO` for what fills a blank profile. */
  displayName: string;
  avatarUrl?: string;
};

export type UserInfoDTO = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

/**
 * What a user is called when their profile says nothing. A blank where a person
 * should be reads as a rendering bug.
 */
export const UNKNOWN_USER = 'Unknown user';

/**
 * Prefers the name a person chose to be called over the handle they log in
 * with. Both may be null on a profile created by the signup trigger from an
 * identity provider that supplied neither.
 */
export const userInfoFromDTO = (dto: UserInfoDTO): UserInfo => {
  const user: UserInfo = {
    id: dto.id,
    displayName: dto.full_name || dto.username || UNKNOWN_USER,
  };

  if (dto.avatar_url) user.avatarUrl = dto.avatar_url;

  return user;
};

/**
 * A user whose profile did not come back — deleted, or not resolvable by this
 * caller. Renders like a profile with no name set.
 */
export const unknownUser = (id: string): UserInfo => ({
  id,
  displayName: UNKNOWN_USER,
});
