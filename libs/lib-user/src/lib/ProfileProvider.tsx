'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  ReactNode,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { ScholarUser } from './types';
import { useSession } from './SessionContext';

export const LIBRARY_ITEMS = [
  'publications',
  'passages',
  'glossaries',
  'bibliographies',
  'searches',
] as const;
export const MENU_ITEMS = ['profile', ...LIBRARY_ITEMS] as const;

export type MenuItem = (typeof MENU_ITEMS)[number];

interface ProfileContextState {
  user?: ScholarUser;
  activeMenu: MenuItem;
  onMenuChange: (menu: MenuItem) => void;
}

export const ProfileContext = createContext<ProfileContextState>({
  activeMenu: 'profile',
  onMenuChange: () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
});

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { getUser } = useSession();

  const [activeMenu, setActiveMenu] = useState<MenuItem>(
    (pathname.split('/').pop() as MenuItem) || 'profile',
  );

  const [user, setUser] = useState<ScholarUser>();

  const onMenuChange = useCallback(
    (menu: MenuItem) => {
      const path = menu === 'profile' ? '/profile' : `/profile/${menu}`;
      router.push(path);
    },
    [router],
  );

  useEffect(() => {
    (async () => {
      const user = await getUser();
      setUser(user || undefined);
    })();
  }, [getUser]);

  useEffect(() => {
    const currentMenu = pathname.split('/').pop() as MenuItem;
    if (MENU_ITEMS.includes(currentMenu)) {
      setActiveMenu(currentMenu);
    }
  }, [pathname]);

  return (
    <ProfileContext.Provider value={{ user, activeMenu, onMenuChange }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfileContext = () => useContext(ProfileContext);
