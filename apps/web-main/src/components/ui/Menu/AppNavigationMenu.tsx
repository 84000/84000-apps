'use client';

import { SimpleDesktopMenu } from './SimpleDesktopMenu';
import { SimpleMobileMenu } from './SimpleMobileMenu';
import { useMenuConfig } from './useMenuConfig';

export const AppNavigationMenu = () => {
  const menuItems = useMenuConfig();

  return (
    <>
      <SimpleDesktopMenu items={menuItems} />
      <SimpleMobileMenu items={menuItems} />
    </>
  );
};
