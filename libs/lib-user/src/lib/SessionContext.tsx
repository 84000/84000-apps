'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  createBrowserClient,
  getUser as getUserCall,
  loginWithApple as loginWithAppleCall,
  loginWithGoogle as loginWithGoogleCall,
  loginWithEmail as loginWithEmailCall,
  logout as logoutCall,
  resetPassword as resetPasswordCall,
  signUpWithEmail as signUpWithEmailCall,
} from '@eightyfourthousand/data-access';
import { SupabaseClient } from '@supabase/supabase-js';
import { ScholarUser } from './types';
import { useRouter } from 'next/navigation';
import { safeNextPath } from '@eightyfourthousand/lib-utils';

interface SessionContextState {
  getUser: () => Promise<ScholarUser | null>;
  apiClient: SupabaseClient | null;
  loginWithApple: () => void;
  loginWithGoogle: () => void;
  loginWithEmail: (email: string, password: string) => void;
  signUpWithEmail: (email: string, password: string) => void;
  logout: () => Promise<void>;
  resetPassword: (email: string) => void;
}

export const SessionContext = createContext<SessionContextState>({
  getUser: async () => null,
  apiClient: null,
  loginWithApple: () => {
    new Error('loginWithApple is not implemented');
  },
  loginWithGoogle: () => {
    new Error('loginWithGoogle is not implemented');
  },
  loginWithEmail: (_email: string, _password: string) => {
    new Error('loginWithEmail is not implemented');
  },
  signUpWithEmail: (_email: string, _password: string) => {
    new Error('signUpWithEmail is not implemented');
  },
  logout: async () => {
    new Error('logout is not implemented');
  },
  resetPassword: (_email: string) => {
    new Error('resetPassword is not implemented');
  },
});

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [apiClient] = useState(createBrowserClient());
  const router = useRouter();

  const getUser = useCallback(async (): Promise<ScholarUser | null> => {
    return getUserCall({ client: apiClient });
  }, [apiClient]);

  const getRedirectUrl = useCallback(() => {
    const base =
      process.env.NEXT_PUBLIC_OATH_REDIRECT_URL ||
      `${window.location.origin}/auth/callback`;

    // `proxy.ts` attaches the originally requested path as `?next=` when it
    // bounces a signed-out visitor here. Forward it to the callback, which
    // already knows how to land on it, so a deep link survives login instead of
    // dropping the user on the homepage.
    const next = safeNextPath(
      new URLSearchParams(window.location.search).get('next'),
    );
    if (!next) {
      return base;
    }

    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}next=${encodeURIComponent(next)}`;
  }, []);

  const loginWithApple = useCallback(() => {
    const redirectTo = getRedirectUrl();
    loginWithAppleCall({ client: apiClient, redirectTo });
  }, [apiClient, getRedirectUrl]);

  const loginWithGoogle = useCallback(() => {
    const redirectTo = getRedirectUrl();
    loginWithGoogleCall({ client: apiClient, redirectTo });
  }, [apiClient, getRedirectUrl]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const redirectTo = getRedirectUrl();
      await loginWithEmailCall({
        client: apiClient,
        email,
        password,
      });

      router.push(redirectTo);
    },
    [apiClient, router, getRedirectUrl],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const redirectTo = getRedirectUrl();
      await signUpWithEmailCall({
        client: apiClient,
        email,
        password,
        redirectTo,
      });
    },
    [apiClient, getRedirectUrl],
  );

  const logout = useCallback(async () => {
    await logoutCall({ client: apiClient });
  }, [apiClient]);

  const resetPassword = useCallback(
    async (email: string) => {
      const redirectTo =
        process.env.NEXT_PUBLIC_OATH_REDIRECT_URL ||
        `${window.location.origin}/auth/reset-password`;
      await resetPasswordCall({
        client: apiClient,
        email,
        redirectTo,
      });
    },
    [apiClient],
  );

  return (
    <SessionContext.Provider
      value={{
        getUser,
        loginWithApple,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        logout,
        resetPassword,
        apiClient,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
