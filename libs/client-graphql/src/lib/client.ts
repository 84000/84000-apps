import { GraphQLClient } from 'graphql-request';
import { getGraphQLUrl } from './config';

let clientInstance: GraphQLClient | null = null;
let getAccessToken: (() => Promise<string | null>) | null = null;

/**
 * Set the access token provider function.
 * This should be called once at app initialization.
 */
export function setAccessTokenProvider(
  provider: () => Promise<string | null>
): void {
  getAccessToken = provider;
}

/**
 * Create a GraphQL client for browser-side requests.
 * Uses Authorization header with dynamic token retrieval for cross-domain requests.
 */
export function createGraphQLClient(): GraphQLClient {
  if (clientInstance) {
    return clientInstance;
  }

  const url = getGraphQLUrl();

  clientInstance = new GraphQLClient(url, {
    // Dynamic headers - called on each request
    requestMiddleware: async (request) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apollo-require-preflight': 'true',
      };

      if (getAccessToken) {
        const token = await getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      return {
        ...request,
        headers,
      };
    },
  });

  return clientInstance;
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetGraphQLClient(): void {
  clientInstance = null;
}
