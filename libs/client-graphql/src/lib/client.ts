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
      if (getAccessToken) {
        const token = await getAccessToken();
        if (token) {
          return {
            ...request,
            headers: {
              ...request.headers,
              Authorization: `Bearer ${token}`,
            },
          };
        }
      }
      return request;
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
