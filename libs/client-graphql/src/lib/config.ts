/**
 * GraphQL API configuration
 */

/**
 * Get the GraphQL API URL from environment variables
 * Falls back to localhost for development
 */
export function getGraphQLUrl(): string {
  const url = process.env.NEXT_PUBLIC_GRAPHQL_URL;

  if (!url) {
    // Default to localhost in development
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3001/api/graphql';
    }
    throw new Error('NEXT_PUBLIC_GRAPHQL_URL environment variable is not set');
  }

  return url;
}
