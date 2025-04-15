'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScholarUser, useSession } from '../context/SessionContext';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppContent } from '../../components/ui/AppContent';
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
    <div className="[--header-height:calc(--spacing(14))]">
      <div className="fixed w-full z-50">
        <AppHeader user={user} handleLogout={handleLogout} />
      </div>
      <div className="flex flex-1 pt-(--header-height)">
        <AppContent>{children}</AppContent>
      </div>
    </div>
  );
}
