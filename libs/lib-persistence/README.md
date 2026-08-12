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
acknowledged writes. Durability is not why this package uses SQLite. The full
findings are recorded on
[DEV-708](https://linear.app/84000/issue/DEV-708/spike-wasm-sqlite-storage-stack-durability-torture-test) —
the spike's findings markdown was deliberately removed along with its harness, so
the Linear issue is the record.

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

One known gap: if the browser restarts the SharedWorker, no tab re-announces
itself, because a `MessagePort` fires no close event for a tab to notice. The
owner tab is unaffected — its ownership comes from the Web Lock and its queries go
to its own worker — but proxy tabs stop being introduced until they reload.
Closing that needs a heartbeat on the coordinator port.

## The journal is never swept up

Two rules follow from the journal being the only copy of unsynced work, and both
are load bearing:

- **Deletes name their ids.** `clearJournal(ids)` and
  `commitSynced(record, syncedJournalIds)` take explicit ids, never a high-water
  mark. `journal.id` is one `AUTOINCREMENT` sequence shared by every passage, so
  "clear everything through id N" silently deletes whatever other passages wrote
  below N. Naming the ids makes it impossible to remove an entry the caller did
  not just sync.
- **No path drops the table.** The schema is split into `JOURNAL_STATEMENTS` and
  the rebuildable rest precisely so that the recovery path below cannot touch it.

## Schema versions

`open()` reads `PRAGMA user_version` before writing it, and acts on what it finds:

| Found                    | What happens                                          |
| ------------------------ | ----------------------------------------------------- |
| `0`                      | Fresh file. Create everything, stamp the version.     |
| `SCHEMA_VERSION`         | Nothing to do.                                        |
| Older                    | Drop and recreate the re-fetchable tables. Journal untouched. |
| Older than `JOURNAL_LAST_CHANGED_AT` | `JournalMigrationRequiredError`.          |
| Newer                    | `SchemaTooNewError`.                                  |

The rebuild works because every table except `journal` is a local copy of server
state, so a stale schema is fixed by re-fetching. That is why there is no
per-version migration list: it would be dead code for tables that can always be
thrown away. The seam that _does_ need hand-written migrations is the journal, and
`JOURNAL_LAST_CHANGED_AT` is what forces the issue — raise it when the journal's
columns change and the open refuses rather than guessing.

Refusing a newer file matters more than it looks: a tab left open across a deploy
would otherwise discard a cache written by newer code and reinterpret a journal
whose shape it may not understand.

## What integrity checking covers

`open()` runs `PRAGMA integrity_check` and sweeps **the whole journal** against its
per-entry checksums. It does **not** sweep the blob stores.

That is a deliberate trade. The journal is bounded by how much has been written
since the last sync and cannot be re-fetched, so it earns the cost every time. The
blob stores are unbounded — they hold every cached work — and sweeping them means
reading and CRC-ing the entire database. Doing that on open made cold-open time and
peak worker memory scale with total cache size: on the 437 MB database DEV-708
tested, seconds of work and roughly half a gigabyte of transient allocation, which
is an OOM risk on mobile Safari.

What actually protects a blob is `getPassageDoc` / `getSpine` / `getCache`
verifying it on the way out and withholding anything that fails. Sweeping at open
buys earlier notice, not more safety.

`sweepAllBlobs()` runs the full sweep deliberately. It is the only way to find
overflow-page corruption _before_ the affected record is read, since that damage
leaves `integrity_check` reporting `ok` — check `blobsSwept` on the report before
reading an empty `corruptBlobs` as a clean bill of health.

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
hand in Safari (all three passed; Safari was confirmed manually). That harness is
not in this tree; recover it from the DEV-708 branch history if a change needs the
same scrutiny.

There is no Playwright setup in this monorepo, so wiring the harness into CI is
its own piece of work rather than something this library can carry. Until then,
**a change to `storage-client.ts`, `opfs-driver.ts` or the coordinator's transport
needs driving by hand in a browser** — the unit tests will not catch a regression
in any of it.

Two things to know if you do:

- Turbopack serves the SharedWorker entry as raw TypeScript, so cross-tab
  proxying fails silently unless `tools/build-storage-assets.mjs` has been run.
  A tab still becomes `owner`, but `ownerId` stays null.
- `playwright-webkit` is not Safari. Its OPFS and SharedWorker implementations
  differ from the shipping engine, so a green WebKit run is not evidence.
  Playwright's Firefox _is_ genuine Gecko and does count.

## Running unit tests

Run `nx test lib-persistence` to execute the unit tests via [Jest](https://jestjs.io).
They cover what is not a browser-runtime fact, in two files:

- `lib/node/node-parity.spec.ts` drives the real `LocalDatabase` against
  `node:sqlite`: the shared schema, per-record checksums, transaction rollback,
  FTS5, the journal-id contract, and the schema-version decision table.
- `lib/coordinator/coordinator.spec.ts` drives the coordinator's routing against
  fake ports: owner announcements, the pending-port queue, and what the directory
  does when a tab dies.

Note that the coordinator's liveness detection is injectable
(`setLivenessWatcher`) purely so it can be tested. Node implements Web Locks, and
in a test nothing holds a tab's liveness lock, so the real watcher would be granted
immediately and evict every client the moment it connected.

Still not covered by anything in CI: the Web Lock election itself, Comlink
proxying over real `MessagePort`s, OPFS, and ownership migration across a real tab
crash. See below.
