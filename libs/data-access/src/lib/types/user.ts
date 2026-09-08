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
