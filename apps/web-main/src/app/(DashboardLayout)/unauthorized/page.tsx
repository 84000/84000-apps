'use client';

import { Button, H2 } from '@design-system';
import { useSession } from '@lib-user';
import { useRouter } from 'next/navigation';

const UnauthorizedPage = () => {
  const { logout } = useSession();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <H2>Access Denied</H2>
      <p className="text-center text-muted-foreground max-w-md">
        You don&apos;t have permission to access the Studio App. This
        application is only available to administrators, editors, and
        translators.
      </p>
      <Button onClick={handleLogout} variant="outline">
        Logout
      </Button>
    </div>
  );
};

export default UnauthorizedPage;
