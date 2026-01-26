export const typeDefs = /* GraphQL */ `
  type Query {
    """
    Health check query
    """
    health: HealthStatus!

    """
    Get the current API version
    """
    version: String!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
  }

  type Mutation {
    """
    Placeholder mutation - replace with your actual mutations
    """
    _placeholder: Boolean
  }
`;
