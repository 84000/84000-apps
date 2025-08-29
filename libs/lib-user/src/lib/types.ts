import { UserRole } from '@data-access';

export type ScholarUser = {
  id: string;
  email: string;
  name?: string | undefined;
  username?: string | undefined;
  avatar?: string | undefined;
  role: UserRole;
  subscriptions: string[];
};

export type LoginVariation = 'create' | 'login';
export type LoginAction = LoginVariation | 'forgot-password';

export type LibraryCache = {
  publications: unknown[];
  passages: unknown[];
  glossaries: unknown[];
  bibliographies: unknown[];
  searches: unknown[];
};
