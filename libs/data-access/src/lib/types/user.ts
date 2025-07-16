export type UserRole = 'reader' | 'scholar' | 'editor' | 'admin';
export type UserClaims = {
  role: UserRole;
};
