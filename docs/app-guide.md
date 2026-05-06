# App & Library Guide

## Apps

### web-main — 84000 Studio

The internal application for translation management. Authenticated via Supabase Auth (Google, Apple, email). Features a dashboard, user library (saved passages, glossaries, bibliographies), and embedded reader/editor views.

- **Route groups**: `(auth)` for login/callback, `(DashboardLayout)` for the authenticated experience
- **Parallel routes**: `/translations/editor/[slug]` and `/translations/reader/[slug]` use `@left`, `@main`, `@right` slots for side-by-side panels
- **Providers**: `InterfaceContextProvider` > `SessionProvider` > `GraphQLAuthProvider` (see `layout.tsx`)
- **API routes**: `/api/feedback` and `/api/mcp`

### web-reader — Public Translation Reader

The public-facing reader for published translations. Minimal auth (optional sign-in for library features).

- **Primary route**: `/[slug]` with parallel routes (`@left`, `@main`, `@right`) for the reading layout
- **Entity pages**: `/entity/[type]/[slug]` for glossary terms, authorities, etc.
- **API routes**: `/api/feedback` and `/api/mcp`

### web-editor — Translation Editor

Standalone TipTap-based rich text editor for working on translations. Builds on `lib-editing`.

### api-graphql — GraphQL API

Next.js API route wrapping Apollo Server. Schema is modular — one folder per domain entity under `src/graphql/schema/`. Handles both cookie and Bearer token authentication.

### web-docs — Documentation Site

Nextra-powered documentation. Content lives in `src/content/` as MDX files. Currently covers database schemas and digital publication workflows.

### node-scripts — Migration Scripts

CLI scripts for one-time data migrations (endnote processing, glossary instance migration, passage reference updates). Not deployed — run locally.

## Libraries

| Library | Alias | Purpose |
|---------|-------|---------|
| **data-access** | `@eightyfourthousand/data-access` | Supabase clients, auth, domain queries, types, DTOs. The core data layer. |
| **client-graphql** | `@eightyfourthousand/client-graphql` | Typed GraphQL client functions. Wraps `graphql-request`. Codegen generates types from `.graphql` files. |
| **design-system** | `@eightyfourthousand/design-system` | 49 UI components built on Radix UI + Tailwind + CVA. Has Storybook. |
| **lib-editing** | `@eightyfourthousand/lib-editing` | TipTap editor integration. Passage ↔ editor node transformations, 42 custom extensions, exporters. |
| **lib-explore** | `@lib-explore` | Chat-based exploration interface. Lamatic API integration for AI workflows. |
| **lib-search** | `@lib-search` | Search functionality. Server actions calling Supabase RPC. UI components for results. |
| **lib-user** | `@lib-user` | User profile management, login components, session context, library pages. |
| **lib-mcp** | `@eightyfourthousand/lib-mcp` | Model Context Protocol server factory. Creates MCP tool handlers for Next.js API routes. |
| **lib-instr** | `@eightyfourthousand/lib-instr` | PostHog analytics integration. Browser client, feature flags, provider, hooks. |
| **lib-utils** | `@eightyfourthousand/lib-utils` | Shared utilities: `cn()` class merging, comparison helpers, text highlighting, React hooks, string manipulation. |

## Dependency Flow

```
Apps (web-main, web-reader, web-editor)
  ├── lib-user (auth UI, session)
  ├── lib-editing (editor, reader components)
  ├── lib-search (search UI and server actions)
  ├── lib-explore (AI exploration)
  ├── lib-instr (analytics)
  ├── client-graphql (GraphQL queries)
  │   └── data-access (types, DTOs)
  ├── design-system (UI components)
  │   └── lib-utils (cn, helpers)
  └── data-access (direct Supabase access)

api-graphql
  └── data-access (Supabase queries, types)
```
