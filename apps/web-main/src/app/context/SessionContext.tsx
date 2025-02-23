'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
  getUser as getUserCall,
  loginWithGoogle as loginWithGoogleCall,
  logout as logoutCall,
} from '../../utils/supabase/actions';

export type ScholarUser = {
  id: string;
  email: string;
  name?: string | undefined;
  username?: string | undefined;
  avatar?: string | undefined;
};

interface SessionContextState {
  getUser: () => Promise<ScholarUser | null>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextState>({
  getUser: async () => null,
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
  const client = createClient();

  const getUser = useCallback(async (): Promise<ScholarUser | null> => {
    return getUserCall({ client });
  }, [client]);

  const loginWithGoogle = useCallback(() => {
    const redirectTo =
      process.env.NEXT_PUBLIC_OATH_REDIRECT_URL ||
      `${window.location.origin}/auth/callback`;

    loginWithGoogleCall({ client, redirectTo });
  }, [client]);

  const logout = useCallback(async () => {
    await logoutCall({ client });
  }, [client]);

  return (
    <SessionContext.Provider value={{ getUser, loginWithGoogle, logout }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
