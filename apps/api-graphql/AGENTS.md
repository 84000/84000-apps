# api-graphql

GraphQL API built with Apollo Server in a Next.js API route.

## Schema Organization

Each domain entity has a folder under `src/graphql/schema/` containing:

- `<entity>.graphql` — type definitions
- `<entity>.query.ts` — Supabase queries
- `<entity>.resolver.ts` — maps queries to schema fields
- `<entity>.loader.ts` — DataLoader for batch optimization (optional)
- `<entity>.field-resolver.ts` — resolves nested fields (optional)
- `<entity>.mutation.ts` — write operations (optional)

Root `Query` and `Mutation` types are defined in `base.graphql` and extended by each entity.

## Authentication

Context (`src/graphql/context.ts`) supports Bearer token (priority) and cookie-based auth. Use `requireAuth(ctx)` to enforce authentication and `requireRole(ctx, role)` to enforce the role hierarchy.

## Adding a New Field

1. Add to the `.graphql` type definition
2. If it needs custom resolution, add a field resolver
3. Add the Supabase query in `.query.ts`
4. Update client queries in `libs/client-graphql/` and run `npm run codegen:client-graphql`
