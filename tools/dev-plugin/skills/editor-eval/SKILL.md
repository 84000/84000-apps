---
name: editor-eval
description: Check the studio translation editor against its feature spec (docs/editor-spec in 84000-apps) on the local stack, and write a machine-readable report with evidence for every item — "run the editor eval", "check the editor against the spec", "does the stack editor still pass ED-STR", "verify the save fixes in a browser". Runs the deterministic Playwright suite, then drives the judged (J) items in Chromium and backs each verdict with DOM or SQL evidence. Local only; never for a hosted Supabase project.
---

# Editor eval

The editor spec lives in `docs/editor-spec/` of 84000-apps. Read its
`README.md` first: it defines the fixture (toh90001/toh90002), what "stored"
means, and the item format. Items are **D** (a Playwright test asserts them),
**J** (someone must drive the UI and judge it) or **D + J** (both).

This skill produces `editor-eval-report.json` with one entry per spec ID it
checked. The format is in [reference/report-format.md](reference/report-format.md).
A verdict without evidence is not a verdict: "it worked" or "the editor said
saved" never counts.

Work from the root of an 84000-apps checkout. The helpers in
`${CLAUDE_SKILL_DIR}/scripts/` find the repo with `git rev-parse`.

## Rules

- **Local only.** Every URL is `http://localhost:<port>` and the database is the
  local Supabase stack from the `infra` checkout. If `supabase status` does not
  show a local stack, or anything points at a hosted project, stop and say so.
  Never use a `.env.local` copied from elsewhere: it may point at production.
- **Never reset the database.** No `supabase db reset`, no truncates. The only
  way to put the fixture back is `make restore-test-work` in `infra`
  (`scripts/restore-test-work.sh`), which touches only toh90001/toh90002.
- **Sign in only as a seeded `@local.test` account**, through the e2e suite's
  setup project (a magic link minted by the local service role). Never type a
  password.
- **SQL is read-only.** Use `${CLAUDE_SKILL_DIR}/scripts/sql.sh`; it refuses
  non-local hosts and opens a read-only session.
- **Don't fix the editor.** Report what you see. If the user asks for a fix,
  that is a separate task.
- Nobody else may be editing the test work in the same local stack while this
  runs: each restore discards their changes.

## Scope

Ask nothing if the request names a scope; otherwise check everything. A scope
is a section (`ED-STR`), a list of IDs, or "judged only". Out-of-scope items
are left out of the report, not marked pass.

## Steps

### 1. Preflight

1. `supabase status -o env` in the infra checkout (`E2E_INFRA_DIR`, else
   `../infra` beside the repo): `API_URL` must be on `127.0.0.1` or
   `localhost`. If the stack is down, stop and tell the user to run
   `make start` in infra.
2. The web app (port `E2E_WEB_PORT`, default 3804) and api-graphql
   (`E2E_GRAPHQL_PORT`, default 3805) either are not running (the suite
   starts them) or were started against the local stack, in dev mode, with
   `NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES=per-passage-docs,translation-hover-cards`
   (without the second flag no hover card ever opens); then set
   `E2E_REUSE_SERVERS=1`. If you can't tell how a server on those ports was
   started, ask.
3. `make restore-test-work` in infra.

### 2. Deterministic items

Run the suite in Chromium for the scope, with a JSON report:

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=apps/web-main-e2e/.playwright/results.json \
  npx playwright test -c apps/web-main-e2e/playwright.config.ts \
  --project=chromium --reporter=list,json [-g ED-STR]
node ${CLAUDE_SKILL_DIR}/scripts/collect-results.mjs \
  apps/web-main-e2e/.playwright/results.json
```

`collect-results.mjs` prints one entry per ID. Copy them into the report as
they are. Don't rerun a failing test to get a pass; record the failure, and
if you rerun it, record both results. The suite takes several minutes for the
whole spec. For a judged-only request, still run the `setup` project
(`--project=setup`), which signs in and writes the session the browser
helper needs.

### 3. Judged items

For each J or D + J item in scope, follow its entry in
[reference/judged-items.md](reference/judged-items.md): what to do, what to
probe, and what counts as a pass. Drive Chromium with a short Node script
that uses the session helper:

```js
import { open } from '<CLAUDE_SKILL_DIR>/scripts/session.mjs';
const { page, close } = await open({ toh: 'toh90001', main: 'translation' });
// ... drive the item, print what the probes see ...
await close();
```

Write the scripts to a scratch directory, not into the repo. Selectors that
are known to work are in [reference/selectors.md](reference/selectors.md).

For each item:

1. **Show the probe works first.** Before reporting an element missing (a
   hover card, a menu entry), run the same probe where the element is known to
   be present and show it finds it. If the probe can't find a known-present
   element, the probe is wrong: fix it, don't report a failure.
2. Do the steps from the spec item, on the visible copy of each element
   (`:visible`). Every passage exists more than once in the DOM.
3. Record what the probe read (`evidence.dom`) and, where the item stores
   something, the query and its output (`evidence.sql`) after Save and a
   reload.
4. If the item changed the fixture, `make restore-test-work` before the next.
5. Write the entry, with `repro` steps a developer could follow by hand.

When a judgement needs a human (a word processor paste, how keyboard
movement feels), do the part a browser can and mark the item `blocked` with
what is left, rather than guessing.

### 4. Finish

1. `make restore-test-work` in infra.
2. Write `editor-eval-report.json` in the current directory (or the path the
   user gave) and check it parses (`node -e "JSON.parse(require('fs').readFileSync('editor-eval-report.json','utf8'))"`).
3. Summarise for the user: counts of pass, fail and blocked; every fail with its
   ID, one line on what went wrong, and the known issue if the spec names one;
   anything new that is worth filing.
4. Stop any servers you started.

## Evals

TODO: the eval suite for this skill (`claude plugin eval`) is not built yet.
Whether its runs get Bash or drive the browser through a Playwright MCP
server is still to be decided, so there are no cases, graders or runner here
yet. See the plugin README.
