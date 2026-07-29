# Node Scripts

Operational scripts run against Supabase with service-level credentials: the publishing
pipeline entry points, plus one-off annotation migrations.

## Overview

Two groups of scripts live here:

- **Publishing** (`publish-work.ts`, `rebuild-published-version.ts`) — durable
  operational commands. All logic lives in `libs/lib-publishing`; these are thin
  wrappers, so the phase 5 publish UI can call the same code path.
- **Annotation migrations** (`migrate-*.ts`) — historical one-offs that enriched
  passage annotations with UUID references alongside existing XML ID references, so
  lookups no longer resolve XML IDs at query time.

## Prerequisites

Create a `.env` file with:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The publishing scripts also accept `SUPABASE_SERVICE_KEY` as a fallback, which is the name
the older `migrate-*` scripts use, so an existing `.env` keeps working. Either way it must
be the **service role** key. Publishing writes to a private
Storage bucket that has no `storage.objects` policy at all, so only `service_role` can
reach it — an anon or user-scoped key cannot publish.

## How to run

Scripts that import workspace libraries by path alias need those aliases resolved at
runtime, which `ts-node` cannot do under ESM. Run those with `tsx`, pointing it at the
tsconfig that carries the alias map:

```bash
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/<script>.ts
```

The older `migrate-*.ts` scripts use only relative imports and still run under
`npx ts-node` as documented below.

## Publishing scripts

### publish-work.ts

Publishes a work: validates draft state, snapshots it into version-scoped `published_*`
rows inside Postgres, serializes an immutable chunked artifact from those frozen rows, then
flips `works.published_version_uuid`. The pointer flip is the only commit point, so any
earlier failure leaves the previously published version live and serving.

```bash
# publish, auto-selecting the next patch version
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-work.ts toh251

# validate only, writing nothing
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-work.ts toh251 --check

# pin the version label, and record why
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-work.ts toh251 \
  --version 1.1.0 --notes "Revised chapter 3"
```

`--check` runs the same SQL rule set the pipeline gates on, so it is a trustworthy
pre-flight rather than an approximation.

Exits non-zero on validation failure, printing every offending entity. Validation has no
override: unresolved reader-critical references must be fixed in the data, not bypassed.

### Recovery, and why there is no scheduler

Publishing has no cron job. Most works finish inside the request; a large one continues in
the background of the same invocation. If that is cut short, the job is left resumable and
**publishing the work again adopts the abandoned job** and continues from its checkpoint —
so recovery is just retrying, whether from this CLI or the editor. Nothing needs to run on a
timer to babysit it.

### rebuild-published-version.ts

Re-materializes `published_*` rows from a version artifact — the repair path. Because the
artifact is canonical, this fixes any divergence in the serving tables without
republishing and without touching draft state.

```bash
# repair: re-materialize the live version from its artifact
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/rebuild-published-version.ts toh251

# roll back: rebuild an older version AND point the work at it
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/rebuild-published-version.ts \
  toh251 --version-uuid <uuid> --repoint

# health check across every published work
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/rebuild-published-version.ts --verify

# ...and clear rows left behind by an interrupted publish
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/rebuild-published-version.ts --verify --gc
```

`--repoint` is required to rebuild a version that is not live, so a rollback is always
deliberate. `--verify` exits non-zero only when a live version has no rows; non-live rows
holding data are reported but are a recoverable state, not a failure.

## Annotation migration scripts

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
