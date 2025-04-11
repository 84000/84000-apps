'use client';

import { Header } from '@design-system';
import Profile from './Profile';
import { ScholarUser } from '../../app/context/SessionContext';
import { AppNavigationMenu } from './AppNavigationMenu';

export const AppHeader = ({
  user,
  handleLogout,
}: {
  user: ScholarUser;
  handleLogout: () => void;
}) => {
  return (
    <Header>
      <div className="flex justify-between w-full gap-4">
        <div className="flex-grow"></div>
        <AppNavigationMenu />
        <Profile user={user} handleLogout={handleLogout} />
      </div>
    </Header>
  );
};
