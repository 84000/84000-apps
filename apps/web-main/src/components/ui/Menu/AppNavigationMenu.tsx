'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@lib-user';
import { MENU_ITEMS } from './MenuItems';
import { NavigationMenuItemProps } from './types';
import { SimpleDesktopMenu } from './SimpleDesktopMenu';
import { SimpleMobileMenu } from './SimpleMobileMenu';

export const AppNavigationMenu = () => {
  const [menuItems, setMenuItems] = useState<NavigationMenuItemProps[]>([]);
  const { getUser } = useSession();

  useEffect(() => {
    (async () => {
      const user = await getUser();
      const role = user?.role || 'reader';
      const filteredItems = MENU_ITEMS.filter(
        (item) => !item.roles?.length || (item.roles || []).includes(role),
      );
      setMenuItems(filteredItems);
    })();
  }, [getUser]);
  return (
    <>
      <SimpleDesktopMenu items={menuItems} />
      <SimpleMobileMenu items={menuItems} />
    </>
  );
};
