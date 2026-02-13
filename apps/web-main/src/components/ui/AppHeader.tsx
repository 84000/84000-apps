'use client';

import { Header } from '@design-system';
import type { ScholarUser } from '@lib-user';
import { ProfileDropdown } from '@lib-user';
import { AppNavigationMenu } from './Menu';

export const AppHeader = ({
  user,
  handleLogoutAction,
}: {
  user: ScholarUser;
  handleLogoutAction: () => void;
}) => {
  return (
    <Header>
      <div className="flex justify-between size-full gap-2">
        <AppNavigationMenu />
        <div className="flex-grow"></div>
        <ProfileDropdown user={user} handleLogout={handleLogoutAction} />
      </div>
    </Header>
  );
};
