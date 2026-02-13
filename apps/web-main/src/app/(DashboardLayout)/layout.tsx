'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ScholarUser, useSession } from '@lib-user';
import { AppHeader } from '../../components/ui/AppHeader';

const ALLOWED_ROLES = ['admin', 'editor', 'translator'];

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { getUser, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ScholarUser | null>();

  useEffect(() => {
    (async () => {
      const user = await getUser();
      setUser(user);

      if (!user) {
        router.replace('/login');
        return;
      }

      // Check role-based access (skip check for unauthorized page to avoid redirect loop)
      if (
        pathname !== '/unauthorized' &&
        !ALLOWED_ROLES.includes(user.role)
      ) {
        router.replace('/unauthorized');
        return;
      }
    })();
  }, [router, getUser, pathname]);

  const handleLogout = () => {
    (async () => {
      logout();
      setUser(null);
      router.replace('/login');
    })();
  };

  if (!user) {
    // TODO: loading skeleton
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader user={user} handleLogoutAction={handleLogout} />
      {children}
    </div>
  );
}
