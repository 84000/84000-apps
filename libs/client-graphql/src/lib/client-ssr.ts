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

  // Build cookie header string with encoded values to ensure HTTP header compatibility
  // Cookie values may contain non-ASCII characters which are invalid in HTTP headers (ByteString)
  const cookieHeader = allCookies
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join('; ');

  const client = new GraphQLClient(url, {
    headers: {
      // Forward cookies for authentication
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });

  return client;
}

/**
 * Create a GraphQL client for build-time requests (generateStaticParams).
 * Does not use cookies since there's no request context during builds.
 *
 * Use this in generateStaticParams and other build-time contexts.
 */
export function createBuildGraphQLClient(): GraphQLClient {
  const url = getGraphQLUrl();
  return new GraphQLClient(url);
}
