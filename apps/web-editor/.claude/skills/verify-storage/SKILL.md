---
name: verify-storage
description: Run the DEV-708 storage durability torture scenarios against the web-editor /storage harness.
---

# Verifying the local storage stack

The harness lives at `/storage` in `web-editor` and exercises
`@eightyfourthousand/lib-persistence`. Every scenario is reachable two ways —
buttons in the page, and `window.__storageHarness` — and they must stay
equivalent, because Chromium is automated while Firefox and Safari are driven by
hand.

## Setup

```sh
node tools/build-storage-assets.mjs apps/web-editor   # REQUIRED, see below
npx nx dev web-editor > /tmp/web-editor.log 2>&1 &
```

The build step is not optional and is not run by `nx dev`. It emits two things
into `public/` that Next's bundler cannot handle:

- `@sqlite.org/sqlite-wasm`, which contains an unresolvable dynamic
  `new Worker(new URL(proxyUri, import.meta.url))` for the plain OPFS VFS's
  async proxy. The SAH pool never executes it; the bundler fails on it anyway.
- The SharedWorker coordinator. Turbopack compiles the dedicated-worker
  `new URL(...)` form but **not** `new SharedWorker(new URL('./x.ts', ...))` —
  it copies the entry into `_next/static/media` as raw TypeScript, and the
  browser fails to parse it. Symptom: the page loads and a tab becomes `owner`,
  but `ownerId` stays `null` and there is a 404 in the console.

Re-run it after any change to the coordinator. `/storage` needs no Supabase.

## Drive it

Playwright is not a repo dependency — install it in the session scratchpad
(`npm i playwright && npx playwright install chromium`).

Use **full Chromium, not `chromium-headless-shell`**:
`chromium.launch({ channel: 'chromium' })`. The shell's SharedWorker and OPFS
support differ from the shipping browser, which is the thing under test.

Key handles on `window.__storageHarness`:

| Call | Purpose |
| --- | --- |
| `status` | `{ role, ownerId, generation, openReport }` |
| `startWriteLoad(runId)` / `writeLoad` | sequential tagged journal appends |
| `verifyAfterKill()` | post-crash verdict; run in a fresh page, same context |
| `startQueryLoad()` / `stopQueryLoad()` | round-tripping load for migration tests |
| `runQuotaPressure(fraction)` | fills the cache table |
| `injectJournalCorruption()` / `injectDatabaseCorruption()` | damage injection |
| `runBenchmark(passageCount)` | SQLite vs IndexedDB |
| `reset()` | wipe all stores and the ack ledger |

Wait on `status.ownerId !== null` before driving anything — the page is ready
before ownership election and the WASM boot have finished.

### Killing a tab for real

`page.close()` is a graceful teardown and does not test durability. Use CDP:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send('Page.crash');
await page.close({ runBeforeUnload: false });  // required before newPage()
```

Chromium refuses `Target.createTarget` while a crashed tab is still open in the
context, so the crashed page must be closed before opening the replacement. Open
the replacement in the **same** context — a new context gets a different storage
partition, so OPFS and `localStorage` would both be empty and the test would
trivially "pass".

### Reaching a real quota limit

A desktop origin quota is a fraction of free disk, so filling to exhaustion is
not feasible; `runQuotaPressure` caps itself at 512 MB and says so in its notes.
To actually hit the wall, lower the quota first:

```js
await cdp.send('Storage.overrideQuotaForOrigin', {
  origin: 'http://localhost:3000',
  quotaSize: 48 * 1024 * 1024,
});
```

There is no equivalent in Firefox or Safari, so record those as untested for
eviction behaviour rather than as passes.

## Firefox and Safari

Run by hand against the same page; `playwright-webkit` is **not** evidence about
Safari. Two tabs are needed for the migration scenario. For the kill test,
crashing a tab by hand is awkward — closing the window mid-write is a weaker but
honest substitute, and should be recorded as such.

`navigator.storage.persist()` behaves differently per engine: Chromium grants it
based on site engagement (so headless reports `persisted: false`), Firefox
prompts, Safari decides heuristically. A `false` here is a finding, not a bug.

## Findings

`docs/spikes/dev-708-storage-durability.md`.
