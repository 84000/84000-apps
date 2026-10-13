# web-main-e2e

Browser checks of the translation editor, written against the items in
[`docs/editor-spec`](../../docs/editor-spec/README.md). Each test is titled with
the spec item it checks, such as `ED-SAV-04`.

The suite runs locally and by hand. Nothing runs it in CI.

## What it needs

- The local Supabase stack from the `infra` repo, running and seeded:
  `make start` there. The test work, `toh90001` and `toh90002`, is part of the
  seed.
- The `infra` checkout beside this repo (`../infra`). Set `E2E_INFRA_DIR` if
  it is somewhere else.
- The browsers, once per machine:

  ```sh
  npx playwright install chromium firefox
  ```

## Running it

```sh
npx nx e2e web-main-e2e                                  # everything
npx nx e2e web-main-e2e -- --project=chromium            # one browser
npx nx e2e web-main-e2e -- --project=chromium -g ED-SAV  # one section
```

The run starts `api-graphql` on port 3805 and `web-main` on 3804 in dev mode,
pointed at the local stack, or reuses servers already on those ports. Set
`E2E_WEB_PORT` and `E2E_GRAPHQL_PORT` to move them. Dev mode is required: it is
the only mode that honours the feature flag override that turns on the passage
stack editor the suite targets.

The suite signs in as `editor@local.test` (`E2E_USER_EMAIL` to change it)
through a magic link minted with the local service role, so it needs no
password.

The report is written to `.playwright/report`:
`npx playwright show-report apps/web-main-e2e/.playwright/report`.

## The test work is shared

Tests save to `toh90001` and `toh90002` in your local database. Before each
test, and after the run, the suite puts the work back to its seeded state with
`infra`'s `scripts/restore-test-work.sh` (`make restore-test-work`). The
restore touches only that work's passages, annotations and comments, and never
resets the database.

Do not run the suite while someone else, or another agent, is editing the test
work in the same local stack: each restore discards their changes too.

The suite refuses to start unless `supabase status` reports a stack on this
machine, and it passes the app the local stack's URL and key whatever
`.env.local` says.

## Spec coverage

```sh
npx nx spec-coverage web-main-e2e
```

Lists the deterministic spec items that have no test, and fails if a test
names an item the spec does not have.
