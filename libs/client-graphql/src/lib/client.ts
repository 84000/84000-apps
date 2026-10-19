import { GraphQLClient } from 'graphql-request';
import {
  CONTENT_SOURCE_HEADER,
  contentSourceFromEnv,
} from '@eightyfourthousand/data-access';
import { getGraphQLUrl } from './config';

let clientInstance: GraphQLClient | null = null;
let getAccessToken: (() => Promise<string | null>) | null = null;

/**
 * A request that failed before it was sent, such as while reading the access
 * token, so the server never saw it.
 */
export class RequestNotSentError extends Error {
  constructor(cause: unknown) {
    super(
      `Request not sent: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'RequestNotSentError';
  }
}

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
        // Which copy of the content this app reads. Declared once per app in
        // next.config.js; every query in the request inherits it, so no query,
        // data function or component has to carry it.
        [CONTENT_SOURCE_HEADER]: contentSourceFromEnv(),
      };

      if (getAccessToken) {
        let token: string | null;
        try {
          token = await getAccessToken();
        } catch (error) {
          throw new RequestNotSentError(error);
        }
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
