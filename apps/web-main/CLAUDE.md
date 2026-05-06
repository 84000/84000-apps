# web-main — 84000 Studio

Internal application for translation management, editing, and research.

## Route Structure

- `(auth)/` — login page and auth callback (not behind dashboard layout)
- `(DashboardLayout)/` — authenticated routes with shared dashboard layout
  - `profile/` — user library (publications, passages, glossaries, bibliographies, searches)
  - `translations/editor/[slug]/` — editor view with parallel routes (`@left`, `@main`, `@right`)
  - `translations/reader/[slug]/` — reader view with parallel routes (`@left`, `@main`, `@right`)
  - `translation/[slug]/` — translation detail page
  - `entity/[type]/[slug]/` — glossary, authority, and other entity pages
  - `research/explore/` — AI-powered exploration interface
- `api/` — feedback endpoint
- `mcp/` — authenticated MCP endpoint (bearer token via Supabase JWT)
- `.well-known/` — OAuth 2.1 discovery (protected resource + authorization server metadata)

## Provider Stack

Root `layout.tsx` wraps the app in: `InterfaceContextProvider` > `SessionProvider` > `GraphQLAuthProvider`.

## Parallel Routes

The editor and reader use `@left`, `@main`, `@right` slots for a three-panel layout. Each slot renders independently and receives the `[slug]` parameter.
