import { UserRole } from '@data-access';

export type ScholarUser = {
  id: string;
  email: string;
  name?: string | undefined;
  username?: string | undefined;
  avatar?: string | undefined;
  role: UserRole;
};

export type LoginVariation = 'create' | 'login';
export type LoginAction = LoginVariation | 'forgot-password';
