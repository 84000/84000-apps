'use client';

import { useEffect } from 'react';
import { DeleteAccountCard } from './DeleteAccountCard';
import { useProfile } from './ProfileProvider';
import { UserCard } from './UserCard';
import { UserSubscriptionsCard } from './UserSubscriptionsCard';

export const ProfilePage = () => {
  const { setPageTitle } = useProfile();

  useEffect(() => {
    setPageTitle('My Profile');
  }, [setPageTitle]);

  return (
    <div className="flex flex-col w-full gap-8">
      <UserCard />
      <UserSubscriptionsCard />
      <DeleteAccountCard />
    </div>
  );
};
