# @eightyfourthousand/lib-persistence

Browser-local storage for the translation editor: WASM SQLite on the
`opfs-sahpool` VFS, in a dedicated worker owned by whichever tab currently holds
the ownership lock, with other tabs proxying through a SharedWorker coordinator.

Built for DEV-708 and hardened by DEV-562. It has no `package.json` because it
is not published — it is consumed inside this monorepo via the
`@eightyfourthousand/lib-persistence` path alias. Add one if and when it needs to
go to npm.

## Why this shape

The design follows Notion's browser-SQLite writeup. The spike set out to prove
that SQLite was _more durable_ than IndexedDB for the unsynced-edit journal —
and **it is not**. Measured over renderer-crash trials, SQLite, IndexedDB with
`durability: 'strict'`, and IndexedDB with the relaxed default all lost zero
acknowledged writes. Durability is not why this package uses SQLite. See
`docs/spikes/dev-708-storage-durability.md`.

The reasons that survived measurement:

- **One library across three local-first peers.** Browser editor tabs, browser
  reader tabs, and a local agent process (Claude Desktop / Codex) all need a
  durable local store. `node:sqlite` runs the same schema, queries, and
  migrations outside the browser. There is no production IndexedDB for Node —
  `fake-indexeddb` is in-memory and loses everything on process restart — so
  IndexedDB would mean two storage layers and two implementations of the
  durability-critical journal.
- **FTS5 for offline reading.** Readers need search over cached works. FTS5
  indexes 17k passages in 111 ms against 2.6 s for a hand-rolled IndexedDB
  inverted index, and supplies BM25 ranking, snippets, prefix queries, and — for
  a canon written in IAST transliteration — diacritic folding, so `manjusri`
  finds `Mañjuśrī`.
- **SQL for everything that is a query.** Cache eviction, conflict detection and
  cache stats are statements rather than hand-rolled cursor walks, and schema
  migrations are ordinary SQL rather than manual data rewrites.
- **One engine, not two.** Docs, spine, journal, and cache in one database makes
  "record the sync and drop the journal entries it covers" a single transaction.
  (IndexedDB also has multi-store transactions, so this argues for one engine,
  not specifically for SQLite.)
- **Per-record checksums on every blob store.** `PRAGMA integrity_check`
  verifies b-tree structure, page linkage and freelist consistency — but _not_
  BLOB payload bytes. Measured on a 420 MB database, 12 rows were silently
  corrupted while the check reported `ok`, because the damage landed in overflow
  pages. So `journal`, `passage_docs`, `spine` and `cache` each carry a CRC-32
  over their payload, verified on read; a record that fails is withheld rather
  than returned, because a corrupt doc that reads as valid gets applied to the
  editor and synced to the server. This is engine-independent and would be worth
  doing on IndexedDB too.

The cost being accepted: a SharedWorker coordinator that exists **only** because
`opfs-sahpool` requires single-writer access, and ~475 KB brotli of WASM.
IndexedDB is natively multi-tab and would need neither.

`opfs-sahpool` is used rather than the plain `opfs` VFS because it needs no
COOP/COEP headers; cross-origin isolation breaks third-party embeds in the
reader and studio apps.

## Layers

| Layer          | File                                          | Runs in                            |
| -------------- | --------------------------------------------- | ---------------------------------- |
| Storage logic  | `lib/worker/database.ts`                      | anywhere — engine-agnostic         |
| Browser driver | `lib/worker/opfs-driver.ts`                   | dedicated worker (owner tab only)  |
| Node driver    | `lib/node/node-driver.ts`                     | agent process, outside the browser |
| Worker entry   | `lib/worker/sqlite.worker.ts`                 | dedicated worker                   |
| Coordinator    | `lib/coordinator/coordinator.sharedworker.ts` | SharedWorker                       |
| Client         | `lib/client/storage-client.ts`                | every tab's main thread            |

`database.ts` holds the schema and every statement and knows nothing about which
engine is underneath. `driver.ts` is the seam — deliberately tiny, because if it
grows the two environments have started to diverge and the one-library claim
stops being true. `src/node.ts` is the entry point for an agent process:

```ts
import { openLocalDatabase } from '@eightyfourthousand/lib-persistence/node';

const db = await openLocalDatabase('./agent-store.db');
await db.appendJournal({ passageUuid, workUuid, update });
```

`src/lib/node/node-parity.spec.ts` runs the real `LocalDatabase` against the Node
driver, and is the check that keeps this honest.

Ownership is decided by a Web Lock held in the tabs, **not** by the coordinator.
A lock is released by the browser even when a tab is killed without running
cleanup code, which a SharedWorker registry cannot detect on its own — there is
no close event on a `MessagePort`. The coordinator's only job is introducing
tabs to the owner's worker; data never flows through it.

`StorageClient` hides which role a tab holds, and retries calls across ownership
migration rather than surfacing an error. That is safe because of what the
payloads are: writes are last-write-wins upserts, and journal payloads are Yjs
updates, which are idempotent on apply. A duplicated append replays harmlessly;
a dropped one loses work.

## Build step

Two things cannot go through Next's bundler, so
`tools/build-storage-assets.mjs` emits them into an app's `public/`:

1. **`@sqlite.org/sqlite-wasm`** contains
   `new Worker(new URL(proxyUri, import.meta.url))` for the plain OPFS VFS's
   async proxy, where `proxyUri` is runtime-only. The SAH pool never takes that
   path, but Turbopack and webpack both fail the build on it anyway. Serving the
   865 KB wasm as a static asset is the right shape regardless.
2. **The SharedWorker coordinator.** Turbopack compiles
   `new Worker(new URL('./x.ts', …))` but not the `SharedWorker` form — it emits
   the entry into `_next/static/media` as a _raw_ file, so the browser is served
   TypeScript and fails to parse it.

```sh
node tools/build-storage-assets.mjs apps/web-editor
```

Output is gitignored. Re-run it after changing the coordinator.

## Verifying browser behaviour

Most of what matters here — OPFS, Web Locks, ownership handoff across a tab
crash — cannot be tested from Node. DEV-708 validated it with a throwaway
in-page harness driven by Playwright in Chromium, Playwright in Firefox, and by
hand in Safari. That harness is not in this tree; recover it from the DEV-708
branch history if a change needs the same scrutiny.

Two things to know if you do:

- Turbopack serves the SharedWorker entry as raw TypeScript, so cross-tab
  proxying fails silently unless `tools/build-storage-assets.mjs` has been run.
  A tab still becomes `owner`, but `ownerId` stays null.
- `playwright-webkit` is not Safari. Its OPFS and SharedWorker implementations
  differ from the shipping engine, so a green WebKit run is not evidence.
  Playwright's Firefox _is_ genuine Gecko and does count.

## Running unit tests

Run `nx test lib-persistence` to execute the unit tests via [Jest](https://jestjs.io).
They cover what is not a browser-runtime fact — the shared schema, per-record
checksums, transaction rollback and FTS5 — by driving the same `LocalDatabase`
against `node:sqlite`.
