# api-mcp — Public MCP API

A minimal Next.js app exposing the 84000 library as a Model Context Protocol (MCP) endpoint. Public, anonymous, read-only — there is no UI.

## Route Structure

- `/v1` — MCP endpoint (`GET`/`POST`/`DELETE`). Built with `createMcpHandler` + `createReadTools` from `@eightyfourthousand/lib-agent`, backed by an anonymous Supabase client (`createAnonServerClient` from `@eightyfourthousand/data-access/ssr`). Exposes read-only tools over translations, glossary, bibliographies, imprints, and tables of contents — works are looked up by UUID or Tohoku catalog number.

The single route handler lives in `src/app/v1/route.ts`. Since the app serves only route handlers, there is no root layout, design system, or static assets.
