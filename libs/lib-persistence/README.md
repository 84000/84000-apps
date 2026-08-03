# @eightyfourthousand/lib-persistence

Browser-local storage for the translation editor: WASM SQLite on the
`opfs-sahpool` VFS, in a dedicated worker owned by whichever tab currently holds
the ownership lock, with other tabs proxying through a SharedWorker coordinator.

**This is spike scaffolding for DEV-708, not a shipping package.** It exists to
find out whether the architecture is durable enough to hold unsynced offline
edits. DEV-562 turns whatever survives into the real library. `package.json` is
marked `private` so it cannot be published by accident.

## Why this shape

The design follows Notion's browser-SQLite writeup, with one difference that
changes the engineering: Notion's local database is a cache, so losing it costs
a slow reload. Ours holds the unsynced-edit journal, which during offline
editing is the **only** copy of a translator's work. So the bar is durability,
not throughput.

That difference drives three decisions:

- **One engine, not two.** Passage docs, spine, journal, and cache live in one
  SQLite database so that "record the sync and drop the journal entries it
  covers" is a single transaction. Split across two engines it becomes a
  write-ordering protocol that either loses edits or replays them.
- **`synchronous = FULL`.** Costs throughput, and buys the property that a
  commit which returned has actually survived.
- **Per-entry checksums on the journal.** SQLite's page integrity catches a
  damaged page. It does not catch a payload written correctly into a page that
  was later rewritten with partial bytes. `readJournal` withholds entries that
  fail verification rather than returning them, because replaying a corrupt Yjs
  update poisons the document it is applied to.

`opfs-sahpool` is used rather than the plain `opfs` VFS because it needs no
COOP/COEP headers; cross-origin isolation breaks third-party embeds in the
reader and studio apps.

## Layers

| Layer        | File                                          | Runs in                           |
| ------------ | --------------------------------------------- | --------------------------------- |
| Database     | `lib/worker/database.ts`                      | dedicated worker (owner tab only) |
| Worker entry | `lib/worker/sqlite.worker.ts`                 | dedicated worker                  |
| Coordinator  | `lib/coordinator/coordinator.sharedworker.ts` | SharedWorker                      |
| Client       | `lib/client/storage-client.ts`                | every tab's main thread           |

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

## Torture harness

`@eightyfourthousand/lib-persistence/harness` and the `/storage` route in
`web-editor`. See `apps/web-editor/.claude/skills/verify-storage/SKILL.md` for
how to run the scenarios, and `docs/spikes/dev-708-storage-durability.md` for
what they found.

## Running unit tests

Run `nx test lib-persistence` to execute the unit tests via [Jest](https://jestjs.io).
