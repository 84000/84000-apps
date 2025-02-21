'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
  getUser as getUserCall,
  loginWithGoogle as loginWithGoogleCall,
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
}

export const SessionContext = createContext<SessionContextState>({
  getUser: async () => null,
  loginWithGoogle: () => {
    new Error('loginWithGoogle is not implemented');
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
    loginWithGoogleCall({ client });
  }, [client]);

  return (
    <SessionContext.Provider value={{ getUser, loginWithGoogle }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
