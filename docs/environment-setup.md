# Environment Setup

## Prerequisites

- Node.js (check `.nvmrc` or `package.json` engines if present)
- npm (this repo uses npm, not pnpm or yarn)
- Vercel CLI (`npm i -g vercel`) for pulling environment variables

## Install Dependencies

```bash
npm install
```

## Environment Variables

Each app deployed to Vercel needs its own `.env.local`. From within the app directory:

```bash
cd apps/web-main
npx vercel env pull --environment development
```

Repeat for any app you're working on (`api-mcp`, `api-graphql`, etc.). Key variables include:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `NEXT_PUBLIC_GRAPHQL_URL` — GraphQL API endpoint (defaults to `http://localhost:3001/api/graphql` in dev)
- `NEXT_PUBLIC_POSTHOG_KEY` — PostHog analytics key
- `NEXT_PUBLIC_POSTHOG_HOST` — PostHog host URL
- `LINEAR_API_KEY` — server-only (`web-main`). Lets the studio MCP's feedback
  tools file Linear issues; without it they report that feedback is not set
  up. `LINEAR_FEEDBACK_TEAM_ID`, `LINEAR_FEEDBACK_STATE_ID` and
  `LINEAR_FEEDBACK_LABEL_{FEATURE,BUG,FEEDBACK}` override the defaults (the
  AI Translation team's Backlog and the Feature, Bug and Feedback labels).

## Running Apps

```bash
# Main studio app (default port 4200)
npx nx dev web-main

# Public MCP API
npx nx dev api-mcp

# GraphQL API (default port 3001)
npx nx dev api-graphql

# Documentation site
npx nx dev web-docs
```

## Design System Storybook

```bash
npx nx storybook design-system
```

## GraphQL Codegen

After modifying `.graphql` files in `libs/client-graphql/`:

```bash
npm run codegen:client-graphql
```

## Useful Nx Commands

```bash
# See available targets for a project
npx nx show project <name>

# Build for production
npx nx build <app-name>

# Run tests
npx nx test <project-name>

# Lint
npx nx lint <project-name>

# Visualize project dependency graph
npx nx graph
```

## Building Publishable Libraries

```bash
npx nx run-many -t build -p lib-utils,data-access,client-graphql,lib-instr,design-system,lib-search,lib-editing
```

Version and publish:

```bash
npm run release:version
npm run release:publish
```
