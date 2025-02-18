'use client';

import React, { createContext, useContext } from 'react';

export type ScholarUser = {
  id: string;
  email: string;
  name?: string | undefined;
  username?: string | undefined;
  avatar?: string | undefined;
};

interface SessionContextState {
  user: ScholarUser | null;
  setUser: (user: ScholarUser | null) => void;
}

export const SessionContext = createContext<SessionContextState>({
  user: null,
  setUser: () => {
    throw new Error('setUser is not implemented');
  },
});

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = React.useState<ScholarUser | null>(null);

  return (
    <SessionContext.Provider value={{ user, setUser }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
