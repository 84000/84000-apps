# AGENTS.md

## What This Repo Is

84000 translates the Tibetan Buddhist canon into modern languages. This Nx monorepo is the web platform: an internal translation studio (`web-main`), a rich text editor (`web-editor`), a GraphQL API (`api-graphql`), a public MCP API (`api-mcp`), and shared libraries. Core domain entities: works, passages, folios, glossaries, annotations, alignments, bibliographies, authorities, and imprints — each identified by UUID and often keyed by Tohoku catalog number (`toh1`, `toh123`, etc.).

## How to Find Things

- **Project targets**: `npx nx show project <name>` lists available commands for any app or lib
- **Import paths**: `tsconfig.base.json` is the canonical map of all path aliases (`@eightyfourthousand/*`, `@lib-*`)
- **Client vs. server exports**: Libraries export from `src/index.ts` (client-safe) and often `src/ssr.ts` (server-only). Use the `/ssr` sub-path for server components, server actions, and route handlers
- **Domain types and DTOs**: `libs/data-access/src/lib/types/` — every entity has a domain type, a DTO (database shape), and `fromDTO`/`toDTO` mappers
- **GraphQL schema**: `apps/api-graphql/src/graphql/schema/` (`.graphql` type definitions, one folder per domain entity)
- **GraphQL client queries**: `libs/client-graphql/src/lib/graphql/` (queries, fragments, mutations)
- **Design system components**: `libs/design-system/src/lib/<ComponentName>/` — check these before building custom UI. Preview with `npx nx storybook design-system`
- **Deeper documentation**: `docs/` folder at the repo root — domain model, data flow, app guide, common tasks
- **Skills and agents**: `libs/lib-agent/skills/` and `libs/lib-agent/agents/` — prose, not code, shipped to the org as Claude Code plugins

## Architectural Constraints

- **Code belongs in `libs/`, not `apps/`**. Apps are thin orchestration layers (routing, layouts, providers).
- Use **path aliases** from `tsconfig.base.json`. Never use relative imports across project boundaries.
- Use the **`/ssr` sub-path** for server contexts, the bare import for client contexts.
- **Error handling**: return `null` or empty arrays on error with `console.error`. Don't throw.
- **Design system first**: components use Radix UI + Tailwind + CVA. Use `cn()` from `@eightyfourthousand/lib-utils` for class merging.
- **Named exports** only in libraries. No default exports.

## Claude Code Plugins

Skills and agents are content rather than code, so they live outside `src/` and
are not compiled:

- **Skills**: `libs/lib-agent/skills/<name>/SKILL.md` (plus a `reference/` folder)
- **Agents**: `libs/lib-agent/agents/<name>.md` (YAML frontmatter + system prompt)

`libs/lib-agent/plugins.json` declares which of them belong to which plugin.
`tools/build-plugins.mjs` assembles each plugin into a **self-contained**
directory inside a checkout of `84000/claude-plugins` and regenerates
`.claude-plugin/marketplace.json`. Claude Code copies a plugin into a cache on
install, so nothing may reference a path outside its own plugin directory — the
generator copies rather than symlinks for that reason.

Versions follow the repo `YYYY.M.X` convention and are written to each plugin's
`plugin.json` **only**; a version in the marketplace entry is silently masked.
When a plugin's content is unchanged the generator keeps its published version,
so installed clients never re-download an untouched plugin.

`.github/workflows/publish-plugins.yml` runs the generator on pushes to `main`
that touch plugin sources. To preview locally without publishing:

```sh
node tools/build-plugins.mjs --target /tmp/marketplace
claude plugin validate /tmp/marketplace --strict
```

## Code Style

Single quotes, 2-space indent, trailing commas — enforced by Prettier (see `.prettierrc`). ESLint config handles the rest. Follow existing patterns in the file you're editing.
