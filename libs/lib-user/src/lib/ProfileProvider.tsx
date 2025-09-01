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
import { LibraryCache, ScholarUser, SubscriptionType } from './types';
import { useSession } from './SessionContext';
import {
  DataClient,
  LIBRARY_ITEMS,
  LibraryItemType,
  UserLibraryItem,
  createBrowserClient,
  getUserBibliographies,
  getAllGlossaryTerms,
  getUserLibrary,
  getUserPassages,
  getUserPublications,
  getUserSearches,
  removeUserLibraryItem,
  updateUserProfile,
} from '@data-access';

export const MENU_ITEMS = ['profile', ...LIBRARY_ITEMS] as const;

export type MenuItem = (typeof MENU_ITEMS)[number];

interface ProfileContextState {
  user?: ScholarUser;
  library: UserLibraryItem[];
  cache: LibraryCache;
  activeMenu: MenuItem;
  pageTitle: string;
  dataClient?: DataClient;
  onMenuChange: (menu: MenuItem) => void;
  refreshCache: (key: LibraryItemType) => Promise<void>;
  refreshProfile: () => Promise<void>;
  removeItem: (uuid: string) => Promise<boolean>;
  saveProfile: (params: {
    avatar?: string;
    name?: string;
    username?: string;
    subscriptions: SubscriptionType[];
  }) => Promise<boolean>;
  setPageTitle: (title: string) => void;
  updateCache: (key: LibraryItemType, items: unknown[]) => void;
}

export const ProfileContext = createContext<ProfileContextState>({
  activeMenu: 'profile',
  pageTitle: 'My Profile',
  cache: {
    publications: [],
    passages: [],
    glossaries: [],
    bibliographies: [],
    searches: [],
  },
  library: [],
  removeItem: async () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
  refreshProfile: async () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
  refreshCache: async () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
  saveProfile: async () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
  setPageTitle: () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
  updateCache: () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
  onMenuChange: () => {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  },
});

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const dataClient = createBrowserClient();

  const { getUser } = useSession();

  const [activeMenu, setActiveMenu] = useState<MenuItem>(
    (pathname.split('/').pop() as MenuItem) || 'profile',
  );
  const [pageTitle, setPageTitle] = useState('My Profile');
  const [user, setUser] = useState<ScholarUser>();
  const [library, setLibrary] = useState<UserLibraryItem[]>([]);
  const [cache, setCache] = useState<LibraryCache>({
    publications: [],
    passages: [],
    glossaries: [],
    bibliographies: [],
    searches: [],
  });

  const onMenuChange = useCallback(
    (menu: MenuItem) => {
      const path = menu === 'profile' ? '/profile' : `/profile/${menu}`;
      router.push(path);
    },
    [router],
  );

  const removeItem = useCallback(
    async (uuid: string) => {
      if (!dataClient || !user) {
        return false;
      }

      const success = await removeUserLibraryItem({
        client: dataClient,
        entityId: uuid,
      });

      return success;
    },
    [dataClient, user],
  );

  const updateCache = useCallback((key: LibraryItemType, items: unknown[]) => {
    setCache((prev) => ({ ...prev, [key]: items }));
  }, []);

  const refreshCache = useCallback(
    async (key?: LibraryItemType) => {
      if (!dataClient || !user) {
        return;
      }

      const libraries = await getUserLibrary({
        client: dataClient,
        userId: user.id,
      });

      setLibrary(libraries);

      if (!key) {
        return;
      }

      const uuids = libraries
        .filter((item) => item.type === key)
        .map((item) => item.uuid);

      if (!uuids.length) {
        setCache((prev) => ({ ...prev, [key]: [] }));
        return;
      }

      let fetchedItems: unknown[] = [];
      switch (key) {
        case 'bibliographies':
          fetchedItems = await getUserBibliographies({
            client: dataClient,
            uuids,
          });
          break;
        case 'passages': {
          const items = await getUserPassages({
            client: dataClient,
            uuids,
          });

          fetchedItems = items.map((item) => ({
            uuid: item.uuid,
            workUuid: item.work?.uuid || '',
            toh: item.work?.toh || '',
            label: item.label,
            content: item.content,
          }));

          break;
        }
        case 'glossaries':
          fetchedItems = await getAllGlossaryTerms({
            client: dataClient,
            uuids,
          });
          console.log(fetchedItems);
          break;
        case 'searches':
          fetchedItems = await getUserSearches({
            client: dataClient,
            uuids,
          });
          break;
        case 'publications': {
          const items = await getUserPublications({
            client: dataClient,
            uuids,
          });

          fetchedItems = items.map((item) => ({
            uuid: item.uuid,
            toh: item.toh,
            enTitle:
              item.titles.find((t) => t.language === 'en')?.content || '',
            boTitle:
              item.titles.find((t) => t.language === 'bo')?.content || '',
            section: item.sections[0]?.label || '',
          }));

          break;
        }
        default:
          break;
      }

      updateCache(key, fetchedItems);
    },
    [dataClient, user, updateCache],
  );

  const refreshProfile = useCallback(async () => {
    const user = await getUser();
    setUser(user || undefined);
  }, [getUser]);

  const saveProfile = useCallback(
    async ({
      avatar,
      name,
      username,
      subscriptions,
    }: {
      avatar?: string;
      name?: string;
      username?: string;
      subscriptions: SubscriptionType[];
    }) => {
      if (!dataClient || !user) {
        return false;
      }

      const success = await updateUserProfile({
        client: dataClient,
        userId: user.id,
        ...user,
        avatar,
        name,
        username,
        subscriptions,
      });

      if (success) {
        await refreshProfile();
      }

      return success;
    },
    [dataClient, user, refreshProfile],
  );

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    refreshCache();
  }, [refreshCache]);

  useEffect(() => {
    const currentMenu = pathname.split('/').pop() as MenuItem;
    if (MENU_ITEMS.includes(currentMenu)) {
      setActiveMenu(currentMenu);
    }
  }, [pathname]);

  return (
    <ProfileContext.Provider
      value={{
        user,
        activeMenu,
        cache,
        library,
        pageTitle,
        dataClient,
        removeItem,
        refreshProfile,
        refreshCache,
        saveProfile,
        setPageTitle,
        updateCache,
        onMenuChange,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
