# Node Scripts

Operational scripts run against Supabase with service-level credentials: the publishing
pipeline entry points.

## Overview

`publish-works.ts` and `rebuild-published-version.ts` are durable operational commands.
All logic lives in `libs/lib-publishing`; these are thin wrappers, so the publish UI can
call the same code path.

Data migrations and backfills do not belong here — they are written as pure SQL and
versioned as migrations in the `infra` repo, which runs them set-based in one round trip
rather than paging rows through an application. A group of `migrate-*.ts` annotation
backfills used to live here and was removed in DEV-719.

## Prerequisites

Create `apps/node-scripts/.env` with:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

`src/load-env.ts` loads it, resolving the path relative to itself rather than to the
working directory — these scripts are run from the repo root, so dotenv's default lookup
would miss the file and, because a missing file is a returned error rather than a throw,
would do it silently. Exported environment variables still win over the file, which is how
you point a single run at a different project without editing it.

`SUPABASE_SERVICE_KEY` is also accepted as a fallback, so an existing `.env` that predates
the rename keeps working. Either way it must
be the **service role** key. Publishing writes to a private
Storage bucket that has no `storage.objects` policy at all, so only `service_role` can
reach it — an anon or user-scoped key cannot publish.

## How to run

These scripts import workspace libraries by path alias, and those aliases need resolving at
runtime, which `ts-node` cannot do under ESM. Run them with `tsx`, pointing it at the
tsconfig that carries the alias map:

```bash
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/<script>.ts
```

## Publishing scripts

### publish-works.ts

Publishes one or many works: validates draft state, snapshots it into version-scoped
`published_*` rows inside Postgres, serializes an immutable chunked artifact from those
frozen rows, then flips `works.published_version_uuid`. The pointer flip is the only commit
point, so any earlier failure leaves the previously published version live and serving.

```bash
# publish, auto-selecting the next patch version
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts toh251

# validate only, writing nothing
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts toh251 --check

# pin the version label, and record why
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts toh251 \
  --version 1.1.0 --notes "Revised chapter 3"

# several works
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts \
  toh251 toh252 toh253

# a list, optionally with per-work version and notes
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts \
  --file works.json

# every work that currently has a published version
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts \
  --all-published --notes "bibliography re-snapshot"
```

`--check` runs the same SQL rule set the pipeline gates on, so it is a trustworthy
pre-flight rather than an approximation. Combined with `--all-published` it validates the
whole corpus without writing anything, which is worth doing before any bulk run.

Exits non-zero on validation failure, printing every offending entity. Validation has no
override: unresolved reader-critical references must be fixed in the data, not bypassed.

`--file` takes either a plain list or objects:

```json
["toh251", "toh252"]
[{ "work": "toh251", "version": "1.1.0", "notes": "Revised chapter 3" }]
```

A shared `--version` is refused for more than one work, because version labels are unique
per work; use the object form instead.

#### Bulk runs

One work failing does not abort the batch — the rest are independent — and the exit code is
non-zero if any failed, with the failures listed at the end.

A run of more than one work refreshes `glossary_term_index` **once** at the start rather
than once per work. The publish pipeline refreshes it per publish by default, because the
snapshot copies that view's output into an immutable artifact and a stale read would be
permanent; but the view is a corpus-wide derivation and repeating it for every work in a
pass where nothing is being edited dominates the run.

**Publishing is not idempotent.** Every run creates a new `work_versions` row and a new
immutable artifact, and neither can be cleanly removed — deleting a version row cascades
away its snapshot rows and nulls the live pointer. So a batch that dies partway through must
not simply be re-run:

```bash
# resume: skip anything whose live version was published at or after this instant,
# so pass the instant the *failed run* started
npx tsx --tsconfig tsconfig.base.json apps/node-scripts/src/publish-works.ts \
  --all-published --skip-published-since 2026-08-17T12:00:00Z
```

The timestamp is the start of the run being resumed, not a date to publish "since" — an
older timestamp skips *more*, not less, because more works have been published after it.

`--skip-published-since` reads `work_versions.published_at` rather than a progress file, so
it cannot disagree with reality. It also gets the ambiguous case right: if a work died after
its pointer flip committed it is skipped, and if it died before, the work is untouched and
gets republished.

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
