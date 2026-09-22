'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ScholarUser, useSession } from '@lib-user';
import {
  createGraphQLClient,
  hasPermission,
} from '@eightyfourthousand/client-graphql';
import { AppHeader } from '../../components/ui/AppHeader';

const UNAUTHORIZED = '/unauthorized';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { getUser, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ScholarUser | null>();
  const [permitted, setPermitted] = useState<boolean>();

  useEffect(() => {
    (async () => {
      const user = await getUser();
      setUser(user);

      if (!user) {
        router.replace('/login');
        return;
      }

      // Asked of the database rather than matched against a list of role names
      // here. Which roles hold `editor.read` is the database's to say, and the
      // list this replaced left out `manager`, which holds it.
      setPermitted(
        await hasPermission({
          client: createGraphQLClient(),
          permission: 'EDITOR_READ',
        }),
      );
    })();
  }, [router, getUser]);

  useEffect(() => {
    if (permitted === false && pathname !== UNAUTHORIZED) {
      router.replace(UNAUTHORIZED);
    }
  }, [permitted, pathname, router]);

  const handleLogout = () => {
    (async () => {
      logout();
      setUser(null);
      router.replace('/login');
    })();
  };

  // Nothing below renders until the answer is in, and nothing but the refusal
  // renders without it. Drawing the page while the redirect is only queued
  // mounts the route underneath, and a route whose own server layout redirects
  // then leaves two navigations in flight — which is what crashed the studio
  // for a signed-in user who lacked access.
  if (!user || permitted === undefined) {
    // TODO: loading skeleton
    return null;
  }

  if (!permitted && pathname !== UNAUTHORIZED) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader user={user} handleLogoutAction={handleLogout} />
      {children}
    </div>
  );
}
