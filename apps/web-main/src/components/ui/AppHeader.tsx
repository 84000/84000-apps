'use client';

import { Header, useSidebar } from '@design-system';
import Profile from './Profile';
import { ScholarUser } from '../../app/context/SessionContext';

export const AppHeader = ({
  user,
  handleLogout,
}: {
  user: ScholarUser;
  handleLogout: () => void;
}) => {
  const { toggleSidebar } = useSidebar();
  return (
    <Header toggleSidebar={toggleSidebar}>
      <div className="flex justify-between w-full gap-2">
        <div className="flex items-center"></div>
        <Profile user={user} handleLogout={handleLogout} />
      </div>
    </Header>
  );
};
