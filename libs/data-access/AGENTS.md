# data-access

Core data layer: Supabase clients, authentication, domain queries, types, and DTOs.

## Dual-Export Pattern

- `src/index.ts` — client-safe exports (browser client, types, UI-related queries)
- `src/ssr.ts` — server-only exports (server client with cookies, feedback handler, entity lookup)

Import `@eightyfourthousand/data-access` for client components, `@eightyfourthousand/data-access/ssr` for server components and actions.

## Supabase Clients

- `createBrowserClient()` — client components, automatic cookie auth
- `createServerClient({ cookies })` — server components, requires Next.js `cookies()`
- `createTokenClient(token)` — Bearer token auth for cross-domain or scripts

## DTO Pattern

Every entity in `src/lib/types/` follows: **DTO** (snake_case, matches DB) → **domain type** (camelCase) → **mapper functions** (`*FromDTO`, `*ToDTO`). The annotation system in `src/lib/types/annotation/` is the most complex, with 30+ types and bidirectional mappers.

## Auth

`src/lib/auth.ts` provides `getSession`, `getUser`, `hasPermission`, plus login/logout/signup functions. Permissions are checked via Supabase RPC (`authorize`).
