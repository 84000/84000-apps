# Node Scripts

Database migration scripts for enriching passage annotations with UUID references.

## Overview

These scripts migrate passage annotations in Supabase to include UUID references alongside existing XML ID references. This enables faster lookups by avoiding the need to resolve XML IDs at query time.

## Prerequisites

Create a `.env` file with:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_KEY=<your-service-key>
```

## Scripts

### migrate-glossary-instances.ts

Migrates `glossary-instance` annotations to include glossary UUIDs.

- Fetches annotations with `glossary_xmlId` but no `uuid`
- Looks up UUIDs from the `glossaries` table (termType: translationMain)
- Upserts enriched content with both `glossary_xmlId` and `uuid`

```bash
npx ts-node apps/node-scripts/src/migrate-glossary-instances.ts
```

### migrate-passage-refs.ts

Migrates `abbreviation` annotations to include passage UUIDs.

- Fetches annotations with `abbreviation_xmlId` but no `uuid`
- Restructures content to include the passage UUID

```bash
npx ts-node apps/node-scripts/src/migrate-passage-refs.ts
```

### migrate-endnotes.ts

Migrates `end-note-link` annotations to include endnote passage UUIDs.

- Fetches annotations with `endnote_xmlId` but no `uuid`
- Looks up UUIDs from the `passages` table
- Upserts enriched content with both `endnote_xmlId` and `uuid`

```bash
npx ts-node apps/node-scripts/src/migrate-endnotes.ts
```

## Shared Modules

| File        | Purpose                                                    |
| ----------- | ---------------------------------------------------------- |
| `config.ts` | Loads environment variables and creates Supabase client    |
| `fetch.ts`  | Paginated query helper for fetching unmigrated annotations |
| `types.ts`  | TypeScript type definitions                                |
