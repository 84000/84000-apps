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
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <AppHeader user={user} handleLogout={handleLogout} />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className={`bg-lightgray dark:bg-dark h-full rounded-bb`}>
              {/* Body Content  */}
              <div className={'w-full py-30 xl:px-30 px-5'}>{children}</div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
