import { GraphQLClient } from 'graphql-request';
import { getGraphQLUrl } from './config';

let clientInstance: GraphQLClient | null = null;

/**
 * Create a GraphQL client for browser-side requests.
 * Uses a singleton pattern to reuse the same client instance.
 */
export function createGraphQLClient(): GraphQLClient {
  if (clientInstance) {
    return clientInstance;
  }

  const url = getGraphQLUrl();

  clientInstance = new GraphQLClient(url, {
    // Credentials are handled by the browser via cookies
    credentials: 'include',
  });

  return clientInstance;
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetGraphQLClient(): void {
  clientInstance = null;
}
