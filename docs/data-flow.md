# Data Flow

## Overview

Data moves through three main paths depending on the context: the public MCP API, the internal studio, and the GraphQL API. All paths ultimately reach Supabase (PostgreSQL) as the data store.

## Supabase Client Types

Three client factories in `libs/data-access/src/lib/`:

| Client | File | Usage | Auth |
|--------|------|-------|------|
| `createBrowserClient()` | `client-browser.ts` | Client components (`'use client'`) | Automatic cookie-based |
| `createServerClient({ cookies })` | `client-server.ts` | Server components, server actions, route handlers | Requires `cookies()` from Next.js |
| `createTokenClient(token)` | `client-token.ts` | Cross-domain requests, scripts | Bearer token in header |

All clients require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables.

The SSR variant (`@eightyfourthousand/data-access/ssr`) re-exports `createServerClient` with cookies pre-wired for Next.js — use this in server components and actions to avoid boilerplate.

## Path 1: Public MCP API (api-mcp)

```
MCP client → api-mcp /v1 (Next.js) → lib-agent + data-access → Supabase
```

1. The `/v1` route handler builds an MCP server via `createMcpHandler` + `createReadTools` from `@eightyfourthousand/lib-agent`
2. The tools run against an anonymous Supabase client (`createAnonServerClient` from `@eightyfourthousand/data-access/ssr`)
3. Read-only queries reach Supabase directly and return translations, glossary terms, bibliographies, imprints, and tables of contents
4. Access is public and anonymous — works are looked up by UUID or Tohoku catalog number

## Local Reader (web-reader)

```
Browser → web-reader (Next.js) → client-graphql → api-graphql → Supabase
```

Server components read through `client-graphql` with no cookies forwarded, and resolve Toh and entity links with an anonymous Supabase client, so the app sees what an anonymous public reader sees. It is a local test bed for the public reader, which lives in the `public-reading-room` repo and consumes the published libs.

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

## Passage and Annotation Writes

Every app write to `passages` and `passage_annotations` goes through
`savePassagesWithDeletions` (`libs/data-access/src/lib/passage/save/`).
- It commits through the `apply_passage_save` RPC.
- Before that, `shift_passage_sorts` makes room for any new passages.
- An ordinary save is one transaction. An import save (`chunked`, from
  `import-preview.ts`) commits chunk by chunk.

This covers the editors, the GraphQL `savePassages` and `replace` mutations,
the MCP passage edits and imports. Outside the save directory,
`one-write-path.spec.ts` fails if app code writes those tables directly
through supabase-js (`.from(...)` with insert, update, upsert or delete). It
cannot catch a new RPC that writes them, so do not add one.

Some writers live outside the apps and bypass that path. They are known and
accepted, and each has an owner. Do not add new ones. Write through the save
path instead.

| Writer | Who runs it | How |
|---|---|---|
| Legacy TEI/XML ingest (the functions are listed below) | A digital editor, from the Supabase SQL editor, as `postgres` | Deletes and reloads a whole work from `migration/translations/<UT>.json`. Only `postgres` and `service_role` can execute these functions; `anon` and `authenticated` cannot. The ingest goes away once the editors stop using TEI as an intermediate step. |
| Alignment loads into `folio_annotations_passage_alignments` | Whoever has dashboard access, from the SQL editor, as `postgres` | Through the `stg_folio_annotations_passage_alignments` staging table, then a direct `INSERT … SELECT`. |
| Dashboard table-editor edits on `passages` and `passage_annotations` | Whoever has dashboard access, as `postgres` | Single-row updates and deletes, with no range or label checks. |
| Ad-hoc SQL scripts | Whoever has dashboard access, from the SQL editor, as `postgres` | For example, a glossary-instance generator (it previews, then inserts), and an indent → paragraph annotation fix-up. |

The ingest runs `fetch_and_insert_json_from_storage`, then
`clear_translations_by_xmlid`, then `process_passages` (which calls
`insert_passage`), then `process_translations_by_xmlid` (which calls
`process_annotations`, `insert_passage_annotation` and `upsert_titles`).

The `indexing` edge function (`infra/supabase/functions/indexing`) also
writes `works`, `titles` and `passages` with the service role, from the legacy
ingest. It first deletes any existing `works` row with the same `xmlId`,
which cascades to that work's titles and passages, and then tries to write the
work again. Against the current schema that write fails (`works` has no
`migrationJson` column), so the work stays deleted. It is still deployed
because an external app may rely on it.

Four more baseline writers have no known caller, but production cannot show
that they are unused yet:
- `insert_passage_annotations`;
- `process_annotation_batch`;
- `process_epic_passages`;
- `delete_passages_batch_by_work_uuid`.

To find out, production has run with `track_functions = 'all'` since
2026-10-19. It is set per role, with `ALTER ROLE <r> SET track_functions =
'all'`, on `postgres`, `authenticator`, `anon`, `authenticated` and
`service_role`, and only new connections pick it up. Data API calls are
counted through `authenticator`, the role PostgREST logs in as. After
2026-11-19, check `pg_stat_user_functions` for these four, and drop any with
no calls. To turn the setting off again, run
`ALTER ROLE <r> RESET track_functions` on each role.
