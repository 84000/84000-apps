'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AccessCheckFailed,
  AccessCheckLoading,
  ScholarUser,
  useSession,
} from '@lib-user';
import {
  createGraphQLClient,
  hasPermission,
} from '@eightyfourthousand/client-graphql';
import { AppHeader } from '../../components/ui/AppHeader';

const UNAUTHORIZED = '/unauthorized';

/** Where the access check stands. `failed` means no answer, not a "no". */
type Access = 'checking' | 'permitted' | 'denied' | 'failed';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { getUser, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ScholarUser | null>();
  const [access, setAccess] = useState<Access>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const user = await getUser();
        if (!active) {
          return;
        }
        setUser(user);

        if (!user) {
          router.replace('/login');
          return;
        }

        // Asked of the database rather than matched against a list of role
        // names here. Which roles hold `editor.read` is the database's to say.
        const permitted = await hasPermission({
          client: createGraphQLClient(),
          permission: 'EDITOR_READ',
        });
        if (active) {
          setAccess(permitted ? 'permitted' : 'denied');
        }
      } catch (error) {
        console.error('Studio access check failed:', error);
        if (active) {
          setAccess('failed');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [router, getUser, attempt]);

  useEffect(() => {
    if (access === 'denied' && pathname !== UNAUTHORIZED) {
      router.replace(UNAUTHORIZED);
    }
  }, [access, pathname, router]);

  const handleRetry = useCallback(() => {
    setAccess('checking');
    setAttempt((n) => n + 1);
  }, []);

  const handleLogout = () => {
    (async () => {
      logout();
      setUser(null);
      router.replace('/login');
    })();
  };

  if (access === 'failed') {
    return (
      <AccessCheckFailed onRetry={handleRetry} onLogout={handleLogout} />
    );
  }

  // Nothing below renders until the answer is in, and nothing but the refusal
  // renders without it. Drawing the page while the redirect is only queued
  // mounts the route underneath, and a route whose own server layout redirects
  // then leaves two navigations in flight — which is what crashed the studio
  // for a signed-in user who lacked access.
  if (!user || access === 'checking') {
    return <AccessCheckLoading />;
  }

  if (access === 'denied' && pathname !== UNAUTHORIZED) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader user={user} handleLogoutAction={handleLogout} />
      {children}
    </div>
  );
}
