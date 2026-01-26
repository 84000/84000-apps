# GraphQL Schema

This directory contains the GraphQL schema definitions. All `.graphql` files in this directory and subdirectories are automatically loaded and merged.

## Structure

```
schema/
├── base.graphql          # Root Query and Mutation types
├── types/                # Shared types
│   └── health.graphql    # Health check types
└── features/             # Feature-specific schemas (create as needed)
    └── users.graphql     # Example: user-related types
```

## Adding New Types

To extend the schema, create a new `.graphql` file and use `extend type` for Query/Mutation:

```graphql
# schema/features/users.graphql

extend type Query {
  users: [User!]!
  user(id: ID!): User
}

extend type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User
  deleteUser(id: ID!): Boolean!
}

type User {
  id: ID!
  email: String!
  name: String
  createdAt: String!
}

input CreateUserInput {
  email: String!
  name: String
}

input UpdateUserInput {
  email: String
  name: String
}
```

## Conventions

- Use `extend type Query` and `extend type Mutation` to add fields
- Place shared types in `types/`
- Group feature-specific schemas in `features/` or by domain
- Include descriptions using `"""` for documentation
