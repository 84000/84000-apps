'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  UserRole,
  createBrowserClient,
  getUser as getUserCall,
  loginWithGoogle as loginWithGoogleCall,
  logout as logoutCall,
} from '@data-access';
import { SupabaseClient } from '@supabase/supabase-js';

export type ScholarUser = {
  id: string;
  email: string;
  name?: string | undefined;
  username?: string | undefined;
  avatar?: string | undefined;
  role: UserRole;
};

interface SessionContextState {
  getUser: () => Promise<ScholarUser | null>;
  apiClient: SupabaseClient | null;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextState>({
  getUser: async () => null,
  apiClient: null,
  loginWithGoogle: () => {
    new Error('loginWithGoogle is not implemented');
  },
  logout: async () => {
    new Error('logout is not implemented');
  },
});

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [apiClient] = useState(createBrowserClient());

  const getUser = useCallback(async (): Promise<ScholarUser | null> => {
    return getUserCall({ client: apiClient });
  }, [apiClient]);

  const loginWithGoogle = useCallback(() => {
    const redirectTo =
      process.env.NEXT_PUBLIC_OATH_REDIRECT_URL ||
      `${window.location.origin}/auth/callback`;

    loginWithGoogleCall({ client: apiClient, redirectTo });
  }, [apiClient]);

  const logout = useCallback(async () => {
    await logoutCall({ client: apiClient });
  }, [apiClient]);

  return (
    <SessionContext.Provider
      value={{ getUser, loginWithGoogle, logout, apiClient }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
