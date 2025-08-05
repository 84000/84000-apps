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
      <div className="pl-6 flex justify-between size-full">
        <AppNavigationMenu />
        <div className="flex-grow"></div>
        <Profile user={user} handleLogout={handleLogout} />
      </div>
    </Header>
  );
};
