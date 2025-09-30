'use client';

import { Button, Header } from '@design-system';
import type { ScholarUser } from '@lib-user';
import { ProfileDropdown } from '@lib-user';
import { AppNavigationMenu } from './Menu';
import { FeedbackButton } from './FeedbackButton';
import { SearchIcon, SparklesIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const AppHeader = ({
  user,
  handleLogoutAction,
}: {
  user: ScholarUser;
  handleLogoutAction: () => void;
}) => {
  const router = useRouter();

  return (
    <Header>
      <div className="flex justify-between size-full gap-2">
        <AppNavigationMenu />
        <div className="flex-grow"></div>
        <Button
          variant="ghost"
          className="[&_svg]:size-6 size-10 my-auto text-brick hover:text-brick/80"
          onClick={() => router.push('/explore')}
        >
          <SparklesIcon />
        </Button>
        <Button
          variant="ghost"
          className="[&_svg]:size-6 size-10 my-auto text-brick hover:text-brick/80"
          onClick={() => router.push('/search')}
        >
          <SearchIcon />
        </Button>
        <FeedbackButton />
        <ProfileDropdown user={user} handleLogout={handleLogoutAction} />
      </div>
    </Header>
  );
};
