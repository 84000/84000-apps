'use client';

import { Header } from '@design-system';
import type { ScholarUser } from '@lib-user';
import { ProfileDropdown } from '@lib-user';
import { AppNavigationMenu } from './Menu';

export const AppHeader = ({
  user,
  handleLogout,
}: {
  user: ScholarUser;
  handleLogout: () => void;
}) => {
  return (
    <Header>
      <div className="flex justify-between size-full">
        <AppNavigationMenu />
        <div className="flex-grow"></div>
        <ProfileDropdown user={user} handleLogout={handleLogout} />
      </div>
    </Header>
  );
};
