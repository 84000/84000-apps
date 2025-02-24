'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './layout/vertical/sidebar/Sidebar';
import Header from './layout/vertical/header/Header';
import { ScholarUser, useSession } from '../context/SessionContext';
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
    <div className="flex w-full min-h-screen dark:bg-darkgray">
      <div className="page-wrapper flex w-full  ">
        {/* Header/sidebar */}

        <Sidebar />
        <div className="page-wrapper-sub flex flex-col w-full dark:bg-darkgray">
          {/* Top Header  */}
          <Header user={user} handleLogout={handleLogout} />

          <div className={`bg-lightgray dark:bg-dark h-full rounded-bb`}>
            {/* Body Content  */}
            <div className={'w-full py-30 xl:px-30 px-5'}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
