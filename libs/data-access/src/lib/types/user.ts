export type UserRole = 'reader' | 'scholar' | 'translator' | 'editor' | 'admin';
export type UserClaims = {
  role: UserRole;
};
