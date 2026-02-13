'use client';

import { MENU_ITEMS } from './MenuItems';
import { SimpleDesktopMenu } from './SimpleDesktopMenu';
import { SimpleMobileMenu } from './SimpleMobileMenu';

export const AppNavigationMenu = () => {
  return (
    <>
      <SimpleDesktopMenu items={MENU_ITEMS} />
      <SimpleMobileMenu items={MENU_ITEMS} />
    </>
  );
};
