'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScholarUser, useSession } from '@lib-user';
import { AppHeader } from '../../components/ui/AppHeader';
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { getUser, logout } = useSession();
  const router = useRouter();

  const [user, setUser] = useState<ScholarUser | null>();

  useEffect(() => {
    (async () => {
      const user = await getUser();
      setUser(user);

      if (!user) {
        router.replace('/login');
        return;
      }
    })();
  }, [router, getUser]);

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
