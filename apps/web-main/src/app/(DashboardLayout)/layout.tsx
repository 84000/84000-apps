'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScholarUser, useSession } from '../context/SessionContext';
import { SidebarInset, SidebarProvider } from '@design-system';
import { AppSidebar } from '../../components/ui/AppSidebar';
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
      console.log(user);
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
      <SidebarProvider className="flex flex-col">
        <div className="fixed w-full z-50">
          <AppHeader user={user} handleLogout={handleLogout} />
        </div>
        <div className="flex flex-1 pt-(--header-height)">
          <SidebarInset>
            <div
              className={`flex flex-1 flex-col bg-lightgray dark:bg-dark h-full`}
            >
              {/* Body Content  */}
              <div className={'w-full p-4'}>{children}</div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
