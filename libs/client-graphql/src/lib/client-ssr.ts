import 'server-only';
import { GraphQLClient } from 'graphql-request';
import { cookies } from 'next/headers';
import { getGraphQLUrl } from './config';

/**
 * Create a GraphQL client for server-side requests (SSR/RSC).
 * Reads auth cookies from the request and forwards them to the GraphQL API.
 *
 * Must be called within a Server Component or Server Action context.
 */
export async function createServerGraphQLClient(): Promise<GraphQLClient> {
  const url = getGraphQLUrl();

  // Get all cookies from the request
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Build cookie header string
  const cookieHeader = allCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const client = new GraphQLClient(url, {
    headers: {
      // Forward cookies for authentication
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });

  return client;
}
