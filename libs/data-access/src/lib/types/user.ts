/**
 * Every value of the database's `app_role` enum. `manager` sits outside the
 * apps' role hierarchy (`ROLE_HIERARCHY`), so hierarchy checks never pass for it.
 */
export type UserRole =
  | 'reader'
  | 'scholar'
  | 'translator'
  | 'editor'
  | 'manager'
  | 'admin';
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

/**
 * The tags a user (or an agent acting for them) may set on their own profile.
 *
 * Tags are SELF-ASSERTED: `user_profiles` lets a user write their own row
 * directly, so a tag records what the user said and nothing more. Never gate a
 * permission, role or feature on one. The allowlist only keeps the column
 * tidy; it is enforced by the tools that write tags, not by the database.
 */
export const PROFILE_TAGS = ['harness.onboarding.completed'] as const;

export type ProfileTag = (typeof PROFILE_TAGS)[number];

/** The caller's own `user_profiles` row, as selected by `getMyProfile`. */
export type UserProfileDTO = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  tags?: string[] | null;
};

/** The caller's own profile. `tags` is never null; see {@link PROFILE_TAGS}. */
export type UserProfile = {
  id: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  tags: string[];
};

export const userProfileFromDTO = (dto: UserProfileDTO): UserProfile => {
  const profile: UserProfile = {
    id: dto.id,
    tags: Array.isArray(dto.tags) ? dto.tags : [],
  };

  if (dto.username) profile.username = dto.username;
  if (dto.full_name) profile.fullName = dto.full_name;
  if (dto.avatar_url) profile.avatarUrl = dto.avatar_url;

  return profile;
};

/**
 * The caller's stored role and effective permissions, from the `get_my_access`
 * definer function: the role as `user_roles` holds it (so `manager` survives),
 * and the role's permissions plus any individual grants. Informational only:
 * permission checks go through `hasPermission`.
 */
export type UserAccess = {
  role: UserRole;
  permissions: UserPermission[];
};
