# Common Tasks

## Add a New Page to web-main

1. Create a route folder under `apps/web-main/src/app/(DashboardLayout)/`
2. Add a `page.tsx` with the page component
3. If the page needs a custom layout, add `layout.tsx` in the same folder
4. Import data functions from `@eightyfourthousand/client-graphql` or `@eightyfourthousand/data-access/ssr`
5. Use design system components from `@eightyfourthousand/design-system`

## Add a New Design System Component

1. Create a folder: `libs/design-system/src/lib/<ComponentName>/`
2. Add `<ComponentName>.tsx` with the component implementation
   - Use Radix UI primitives where applicable
   - Style with Tailwind via `cn()` from `@eightyfourthousand/lib-utils`
   - Use CVA for variants
3. Add `<ComponentName>.stories.tsx` for Storybook documentation
4. Export from `libs/design-system/src/index.ts`
5. Preview: `npx nx storybook design-system`

## Add a New GraphQL Field

1. **Schema**: Add the field to the appropriate `.graphql` file in `apps/api-graphql/src/graphql/schema/<entity>/`
2. **Resolver**: If the field needs custom resolution, add it to the entity's `.resolver.ts` or `.field-resolver.ts`
3. **Query implementation**: Add the Supabase query in the entity's `.query.ts`
4. **Client query**: Update the `.graphql` query/fragment in `libs/client-graphql/src/lib/graphql/`
5. **Codegen**: Run `npm run codegen:client-graphql` to regenerate TypeScript types
6. **Client function**: If needed, add or update a function in `libs/client-graphql/src/lib/functions/`

## Add a New GraphQL Entity

Follow the pattern of an existing entity (e.g., `passage/`):

1. Create `apps/api-graphql/src/graphql/schema/<entity>/`
2. Add `<entity>.graphql` — type definition with fields
3. Add `<entity>.query.ts` — Supabase queries
4. Add `<entity>.resolver.ts` — map queries to schema fields
5. Optionally add `<entity>.loader.ts` for DataLoader batching
6. Extend the root `Query` type in `base.graphql`
7. Add client-side query files and functions in `libs/client-graphql/`

## Add a New Supabase Query

1. Add the query function in the appropriate file under `libs/data-access/src/lib/`
2. Follow the DTO pattern:
   - Define a `*DTO` type matching database columns (snake_case) in `libs/data-access/src/lib/types/`
   - Define a domain type (camelCase)
   - Add `*FromDTO` and `*ToDTO` mapper functions
3. Export from `libs/data-access/src/index.ts` (client-safe) or `src/ssr.ts` (server-only)
4. Handle errors by returning `null` or empty arrays with `console.error`

## Add a New Library

1. Generate: `npx nx g @nx/js:library libs/<lib-name>`
2. Add path aliases to `tsconfig.base.json`:
   - Main: `@eightyfourthousand/<lib-name>` → `libs/<lib-name>/src/index.ts`
   - SSR (if needed): `@eightyfourthousand/<lib-name>/ssr` → `libs/<lib-name>/src/ssr.ts`
3. Export public API from `src/index.ts`
4. Use named exports only

## Add a New TipTap Extension

1. Create the extension file in `libs/lib-editing/src/lib/components/editor/Extensions/`
2. Follow the TipTap extension API (Node, Mark, or Extension)
3. Add a transformer in `libs/lib-editing/src/lib/transformers/` to convert annotations → editor nodes
4. Add an exporter in `libs/lib-editing/src/lib/exporters/` to convert editor nodes → annotations
5. Register the extension in the editor configuration

## Run GraphQL Codegen

```bash
npm run codegen:client-graphql
```

This reads `.graphql` files from `libs/client-graphql/` and generates TypeScript types. Run after modifying any `.graphql` query, fragment, or mutation file.

## Run Tests

```bash
npx nx test <project-name>
```

Test files use `.spec.ts` / `.test.tsx` convention, colocated with source files. Jest is the test runner.
