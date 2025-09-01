import { UserRole } from '@data-access';

export const SUBSCRIPTION_TYPES = ['news'] as const;

export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

export type ScholarUser = {
  id: string;
  email: string;
  name?: string | undefined;
  username?: string | undefined;
  avatar?: string | undefined;
  role: UserRole;
  subscriptions: SubscriptionType[];
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
