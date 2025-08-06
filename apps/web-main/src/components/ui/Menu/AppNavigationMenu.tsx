'use client';

import { MENU_ITEMS } from './MenuItems';
import { useEffect, useState } from 'react';
import { useSession } from '../../../app/context/SessionContext';
import { NavigationMenuItemProps } from './types';
import { MobileMenu } from './MobileMenu';
import { DesktopMenu } from './DesktopMenu';

export const AppNavigationMenu = () => {
  const [menuItems, setMenuItems] = useState<NavigationMenuItemProps[]>([]);
  const { getUser } = useSession();

  useEffect(() => {
    (async () => {
      const user = await getUser();
      const isAdmin = user?.role == 'admin';
      const filteredItems = MENU_ITEMS.filter(
        (item) => !item.isAdmin || (item.isAdmin && isAdmin),
      );
      setMenuItems(filteredItems);
    })();
  }, [getUser]);
  return (
    <>
      <DesktopMenu items={menuItems} />
      <MobileMenu items={menuItems} />
    </>
  );
};
