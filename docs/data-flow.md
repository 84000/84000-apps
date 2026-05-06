# Data Flow

## Overview

Data moves through three main paths depending on the context: the public reader, the internal studio, and the GraphQL API. All paths ultimately reach Supabase (PostgreSQL) as the data store.

## Supabase Client Types

Three client factories in `libs/data-access/src/lib/`:

| Client | File | Usage | Auth |
|--------|------|-------|------|
| `createBrowserClient()` | `client-browser.ts` | Client components (`'use client'`) | Automatic cookie-based |
| `createServerClient({ cookies })` | `client-server.ts` | Server components, server actions, route handlers | Requires `cookies()` from Next.js |
| `createTokenClient(token)` | `client-token.ts` | Cross-domain requests, scripts | Bearer token in header |

All clients require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables.

The SSR variant (`@eightyfourthousand/data-access/ssr`) re-exports `createServerClient` with cookies pre-wired for Next.js — use this in server components and actions to avoid boilerplate.

## Path 1: Public Reader (web-reader)

```
Browser → web-reader (Next.js) → client-graphql → api-graphql → Supabase
```

1. `web-reader` routes render server components that call functions from `@eightyfourthousand/client-graphql`
2. `client-graphql` uses `graphql-request` to send typed queries to `api-graphql`
3. `api-graphql` resolvers create a Supabase client (from cookie or Bearer token) and query the database
4. Responses flow back through the GraphQL layer, with DTOs transformed to domain types at the client-graphql boundary

The reader is unauthenticated for public content but supports logged-in features (library, bookmarks).

## Path 2: Internal Studio (web-main)

```
Browser → web-main (Next.js)
  ├── Reads: client-graphql → api-graphql → Supabase
  └── Writes: data-access (direct Supabase) → Supabase
```

- **Reads** go through GraphQL (same path as the reader) for consistency and caching
- **Writes** (saving passages, replacing text) go through `client-graphql` mutations → `api-graphql` → Supabase
- **Server actions** (search, auth) use `data-access/ssr` to call Supabase directly via RPC

## Path 3: GraphQL API (api-graphql)

The GraphQL server is a Next.js API route (`apps/api-graphql/src/app/api/graphql/route.ts`) wrapping Apollo Server.

### Schema Organization

Each domain entity has a folder under `apps/api-graphql/src/graphql/schema/`:

```
schema/
├── base.graphql          # Root Query and Mutation types
├── work/
│   ├── work.graphql      # Work type, WorkConnection
│   └── title.graphql     # Title type
├── passage/
│   └── passage.graphql   # Passage, PassageConnection, mutations
├── annotation/
│   └── annotation.graphql
├── glossary/
│   └── glossary.graphql
├── bibliography/
│   └── bibliography.graphql
├── alignment/
│   └── alignment.graphql
├── folio/
│   └── folio.graphql
├── imprint/
│   └── imprint.graphql
├── toc/
│   └── toc.graphql
├── user/
│   └── user.graphql
└── health/
    └── health.graphql
```

### Context and Authentication

`apps/api-graphql/src/graphql/context.ts` creates the request context:

1. Checks for Bearer token in `Authorization` header (cross-domain clients)
2. Falls back to cookie-based auth (same-domain requests)
3. Decodes JWT to extract `user_role` and identity
4. Creates a Supabase client and data loaders

Helper functions:
- `requireAuth(ctx)` — throws if not authenticated
- `requireRole(ctx, role)` — enforces role hierarchy (`reader < scholar < translator < editor < admin`)

### Client-Side GraphQL

`libs/client-graphql/` provides typed functions that wrap `graphql-request`:

- Client setup: `createGraphQLClient()` with Bearer token middleware
- Queries are `.graphql` files in `libs/client-graphql/src/lib/graphql/`
- Functions in `libs/client-graphql/src/lib/functions/` call the queries and transform DTOs
- Codegen: `npm run codegen:client-graphql` generates TypeScript types from `.graphql` files

## The SSR/Client Boundary

Libraries use a dual-export pattern:

- `src/index.ts` — exports safe for both client and server (types, browser client, UI components)
- `src/ssr.ts` — exports that require server-only APIs (cookies, headers, Node.js modules)

Import patterns:
```typescript
// Client component
import { createBrowserClient } from '@eightyfourthousand/data-access';

// Server component or action
import { createServerClient } from '@eightyfourthousand/data-access/ssr';
```

This is enforced by the `tsconfig.base.json` path aliases — the `/ssr` sub-path points to a different entry file.

## Search

Search uses Supabase RPC functions called via server actions:

```
UI → server action (libs/lib-search) → createServerClient() → Supabase RPC (translation_search)
```

Search covers passages, alignments (Tibetan source), glossary terms, and bibliography entries. See `libs/lib-search/src/lib/data/search.ts`.

## Editor Data Flow

The editor (TipTap-based) has its own transformation pipeline:

```
Supabase → Passage[] → blocksFromTranslationBody() → TipTap editor nodes
                                                              ↓ (user edits)
Supabase ← passageToDTO() ← passagesFromNodes() ← TipTap editor state
```

- **Passages → Editor**: `libs/lib-editing/src/lib/block.ts` converts `Passage[]` to `TranslationEditorContent` (TipTap node structure). Annotations are applied as TipTap marks and node attributes via transformers in `libs/lib-editing/src/lib/transformers/`.
- **Editor → Passages**: `libs/lib-editing/src/lib/passage.ts` extracts passages from editor state. Exporters in `libs/lib-editing/src/lib/exporters/` reverse the annotation transformation.
- **Saving**: `EditorProvider` manages dirty tracking and calls `savePassages` via GraphQL mutation.
