'use client';

import { DeleteAccountCard } from './DeleteAccountCard';
import { useProfileContext } from './ProfileProvider';
import { UserCard } from './UserCard';
import { UserSubscriptionsCard } from './UserSubscriptionsCard';

export const ProfilePage = () => {
  const { user } = useProfileContext();

  return (
    <div className="flex flex-col w-full gap-8">
      <UserCard user={user} />
      <UserSubscriptionsCard user={user} />
      <DeleteAccountCard user={user} />
    </div>
  );
};
