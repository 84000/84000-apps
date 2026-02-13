'use client';

import { useEffect } from 'react';
import { setAccessTokenProvider } from '@client-graphql';
import { useSession } from './SessionContext';

/**
 * Provides authentication tokens to the GraphQL client.
 * This enables cross-domain GraphQL requests by using Authorization headers
 * instead of relying on cookies (which don't work cross-domain).
 */
export const GraphQLAuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { apiClient } = useSession();

  useEffect(() => {
    if (apiClient) {
      setAccessTokenProvider(async () => {
        const { data } = await apiClient.auth.getSession();
        return data.session?.access_token ?? null;
      });
    }
  }, [apiClient]);

  return <>{children}</>;
};
