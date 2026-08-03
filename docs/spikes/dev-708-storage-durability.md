# DEV-708 — WASM SQLite storage stack: durability findings

**Verdict: proceed with the single-engine SQLite design. The journal-in-IndexedDB
fallback is not required.**

Two caveats gate that verdict: **Safari is untested** (see
[Not tested](#not-tested)), and **the reason for choosing SQLite is not the one
the spike set out to test.**

The spike asked whether the architecture is durable enough to hold the
unsynced-edit journal, which during offline editing is the only copy of a
translator's work. It is — but so is IndexedDB. Measured head-to-head over
renderer-crash trials, SQLite, IndexedDB with `durability: 'strict'`, and
IndexedDB with the relaxed default **all lost zero acknowledged writes**.

So durability does not decide this. What does is that three _local-first_ peers
need the same store — browser editor tabs, browser reader tabs, and a local agent
process running in Claude Desktop or Codex — and that offline readers need
full-text search. On both counts SQLite wins outright, and neither was in the
original framing. See [Why SQLite, given that](#why-sqlite-given-that).

---

## What was built

`libs/lib-persistence` — see its `README.md` for the architecture, and
`apps/web-editor/.claude/skills/verify-storage/SKILL.md` for how to re-run any of
this. The harness lives at `/storage` in `web-editor` and on
`window.__storageHarness`.

The two capabilities the recommendation rests on are demonstrated rather than
asserted: the storage logic sits behind a driver seam with a `node:sqlite`
implementation (`src/node.ts`, exercised by `node-parity.spec.ts`), and the FTS5
index is a harness scenario like the others.

![The torture harness with scenarios 1, 4 and 5 run](./dev-708-harness.png)

## How it was tested

|                  | Chromium 151                         | Firefox 153                  | Safari      |
| ---------------- | ------------------------------------ | ---------------------------- | ----------- |
| Driver           | Playwright + CDP                     | Playwright (genuine Gecko)   | **not run** |
| Tab kill         | real renderer crash (`Page.crash`)   | graceful close only — no CDP | —           |
| Quota exhaustion | real, quota lowered to 48 MB via CDP | not forceable                | —           |

Playwright's WebKit was deliberately **not** used. Its OPFS and SharedWorker
implementations are not Safari's, so a green WebKit run would be a false pass on
the engine most likely to fail.

Firefox's kill test is weaker than Chromium's: a graceful `close()` lets teardown
code run, so it does not prove what a crash proves. It is reported as the weaker
result it is.

## Results

### 1 · Kill the active tab mid-write — PASS

Journal entries are appended strictly sequentially, each tagged with a run id and
sequence number, so the expected post-crash state is exactly describable: a
contiguous prefix and nothing else. Any hole is silent partial state.

The oracle for "this edit was acknowledged" is a `localStorage` ledger written
after each append resolves. It can only lag the journal, never lead it, so it can
under-report loss but cannot raise a false alarm.

|                   | Chromium (real crash) | Firefox (graceful close) |
| ----------------- | --------------------- | ------------------------ |
| Acknowledged      | 153                   | 90                       |
| Persisted         | 153                   | 90                       |
| Gaps inside range | 0                     | 0                        |
| Failed checksums  | 0                     | 0                        |

Every acknowledged write survived. The revived tab took the database over in
about one second and reported `integrity_check` clean.

### 2 · Ownership migration under load — PASS (Chromium)

A second tab proxying queries through the owner, then the owner's renderer
crashed mid-flight.

- 32 issued, **32 succeeded, 0 failed, 0 wrong answers**
- The follower won the ownership lock and became owner
- `integrity_check` clean afterwards; a write/read round trip succeeded
- **Worst-case latency 10,020 ms**

That last number is the finding. 10 s is `CALL_TIMEOUT_MS` — the point at which a
hung call is taken as evidence the owner died. Correctness is fine (the call was
retried against the new owner and succeeded), but a user closing a window can
stall another window's query for ten seconds. See
[Issues for Phase 1](#issues-for-phase-1).

Firefox was checked for two-tab coordination but not migration-under-crash, since
it cannot be crashed on demand: owner/proxy roles were elected correctly and
26/26 proxied queries succeeded.

### 3 · Quota pressure — PASS

A desktop origin quota is a fraction of free disk, so filling to exhaustion is
not feasible; the quota was lowered to 48 MB over CDP to make the wall reachable.

- Journal **677 → 677 entries**, unchanged
- Fill stopped cleanly at 44.3 MB with `SQLITE_IOERR: disk I/O error`
- `integrity_check` clean afterwards

Hitting the quota produces an ordinary write error, not corruption, and the cache
filling up does not cost unsynced edits.

**But `navigator.storage.persist()` returned `false`** in both headless browsers.
The protection against the browser evicting the whole origin under pressure is
therefore _unverified_. Chromium grants persistence based on site engagement,
which headless has none of; Firefox prompts. This needs confirming in a real
profile — it is the difference between "the journal survives quota pressure" and
"the journal survives, unless the browser deletes the origin".

### 4 · Corruption injection — PASS

Two injection points, because they exercise different defences.

**Journal payload** (bytes flipped via SQL, database left structurally perfect —
the case SQLite's own integrity cannot see): detected by the per-entry CRC-32 in
both engines. The entry was _withheld from replay_ rather than returned as valid,
which is the property that matters — replaying a corrupt Yjs update would poison
the document it applied to.

**Database file** (768 bytes flipped across 12 sites in the OPFS file, VFS
paused): detected by `PRAGMA integrity_check` on re-open in both engines, with
concrete page-level errors. Never served as plausible garbage.

> A methodology note worth keeping. Earlier runs reported Firefox _failing_ to
> detect file corruption. That was the harness, not Firefox: a single 64-byte
> flip at the midpoint of the pool slot landed either in the slot's unused tail
> or in a free page, and `integrity_check` correctly does not validate
> unallocated pages. Spreading damage across 12 sites inside the live database
> fixed it. The injector now also reports `injected: false` when it fails to
> inflict damage, so a broken injector can never again read as a clean pass.

### 6 · Offline reader search — PASS

The reader was not in the original scope and has no journal, so nothing above
applies to them. What they need is search.

Indexing 5,000 passages took **2,132 ms** (0.43 ms each) in Chromium, and queries
returned in 1.3–3.3 ms with BM25-ranked, delimited snippets:

```
equipoise             3.30 ms   They rest in [equipoise] within the bodies of…
perfection of wisdom  2.00 ms   Thus did the Tathāgata proclaim the [perfection] [of] [wisdom]…
```

All six ASCII probes matched their IAST spellings — `manjusri`, `sariputra`,
`dharani`, `sangha`, `bhagavan`, `tathagata`. For a canon written in
transliteration and read by people on ordinary keyboards, that is a correctness
requirement rather than a nicety, and it is one tokenizer option
(`unicode61 remove_diacritics 2`) rather than a subsystem.

`node:sqlite` ships FTS5 with the same folding, so search works identically in an
agent process.

### 5 · Cost

Mean milliseconds per operation, 2,000 synthetic passage docs sized from the real
local database (mean 273 B content, 5.7 annotations/passage). The IndexedDB
baseline uses `durability: 'strict'`; switching it from the relaxed default
changed its figures by under 3%, so the gap below is not an artefact of comparing
a durable write against a non-durable one.

| Access pattern                      | Chromium SQLite | Chromium IDB | Firefox SQLite | Firefox IDB |
| ----------------------------------- | --------------- | ------------ | -------------- | ----------- |
| Bulk write 2,000 docs (1 txn)       | 0.040           | 0.022        | 0.053          | 0.025       |
| Write 200 docs (1 txn each)         | 2.520           | 0.136        | 0.840          | 0.110       |
| Windowed read, 40 passages          | 0.252           | 0.068        | 0.125          | 0.075       |
| Journal append (`synchronous=FULL`) | 3.637           | 0.110        | 1.030          | 0.115       |

Cold open: **109 ms** Chromium, **106 ms** Firefox.

WASM payload, 1.44 MB uncompressed across `sqlite3.wasm`, the glue module and the
coordinator:

|                     | gzip   | brotli     |
| ------------------- | ------ | ---------- |
| Total over the wire | 543 KB | **463 KB** |

It is fetched _by the worker_, not the page, so it is off the critical path for
first paint — it delays the first query, not the first render, and can be
lazy-loaded behind an explicit "make available offline" action.

In terms the product cares about:

- Caching a 2,000-passage work: **~80 ms** (Chromium), ~106 ms (Firefox).
- A 40-passage scroll window: **~10 ms** / ~5 ms.
- One offline edit: **~3.6 ms** / ~1.0 ms.

**On the 33× ratio for journal appends.** It is real, and it is _not_ the price
of durability — that was my first assumption and it is wrong. Rebuilding with
`synchronous = NORMAL` gives 3.71 ms per append against FULL's 3.64 ms: identical
within noise. The cost on this VFS is the OPFS `SyncAccessHandle` write path plus
the worker `postMessage` round trip, which the main-thread IndexedDB baseline
does not pay. `synchronous = FULL` is therefore free here, and is kept as no-cost
insurance against power loss.

Batching collapses the gap anyway: the same 2,000 writes cost 18.5× per row
one-at-a-time and 1.8× in a single transaction.

## Durability, head to head

The spike originally measured only SQLite, so it could show SQLite _clears the
bar_ but not that it beats IndexedDB. This closes that gap: five real
renderer-crash trials per configuration, identical discipline (append → await
commit → record ack in `localStorage`), with the IndexedDB side written
independently of `lib-persistence` so a shared harness bug could not mask a
difference.

| Configuration                               | Trials losing acked data | Entries lost |
| ------------------------------------------- | ------------------------ | ------------ |
| SQLite `synchronous = FULL`                 | 0 / 5                    | 0            |
| SQLite `synchronous = NORMAL`               | 0 / 5                    | 0            |
| IndexedDB `durability: 'strict'`            | 0 / 5                    | 0            |
| IndexedDB `durability: 'relaxed'` (default) | 0 / 5                    | 0            |

**No configuration lost anything.** The durability premise does not distinguish
the engines.

The limit of this result: `Page.crash` kills the renderer, not the machine. The
browser process and OS page cache survive — which is exactly what relaxed
durability relies on. This covers tab crashes and OOM kills, the common real
failures, but **not power loss**. Separating strict from relaxed needs a VM
hard-reset harness, which nobody has run.

## Why SQLite, given that

Durability having washed out, three things decide it. Two of them were not in the
original framing, because they come from users the spike did not consider: a
local agent process, and the offline reader.

**1. Three local-first peers, one library.** Browser editor tabs, browser reader
tabs, and a local agent (Claude Desktop / Codex) all need a durable local store,
and the agent cannot reach the browser's OPFS. `node:sqlite` — built into Node 24
— runs the same schema, queries and migrations outside the browser. There is no
production IndexedDB for Node: `fake-indexeddb` describes itself as _"a pure JS
in-memory implementation"_ and loses everything on process restart. IndexedDB
therefore means two storage layers and two implementations of the
durability-critical journal.

**2. Offline readers need search.** Over 17,440 real 84000 passages:

|                                | SQLite FTS5                | Hand-rolled IndexedDB index |
| ------------------------------ | -------------------------- | --------------------------- |
| Index build                    | **111 ms**                 | 2,592 ms                    |
| Query latency                  | 0.0–2.1 ms                 | 0.1–2.1 ms                  |
| Implementation                 | one `CREATE VIRTUAL TABLE` | ~70 lines                   |
| BM25 ranking, snippets, prefix | built in                   | not implemented             |
| Diacritic folding              | one tokenizer option       | not implemented             |

Query latency is a wash; everything else is not. The folding matters
disproportionately for this corpus — with `unicode61 remove_diacritics 2`, a
reader on an ASCII keyboard searching `manjusri`, `sariputra`, `dharani`,
`sangha` or `bhagavan` matches `Mañjuśrī`, `Śāriputra`, `dhāraṇī`, `saṅgha`,
`Bhagavān`. Hand-rolling correct Unicode folding plus BM25 plus snippet
highlighting is a project in itself.

Note the reader has **no journal at all**, so the durability question that
motivated this spike is irrelevant to them. Search is what they need.

**3. SQL for things that are queries.** Phase 3 eviction — TTL plus size-capped
LRU that never evicts a work with unsynced edits — is ~10 lines of SQL against
~55 lines of IndexedDB cursor walking that loads all survivors into memory to
sort (measured: 320 ms for 5,000 entries, invariant upheld). Conflict detection
and cache stats trend the same way, and IndexedDB has no `ALTER`, so migrations
are manual data rewrites forever.

### What this costs

A SharedWorker coordinator that exists **only** because `opfs-sahpool` demands
single-writer access, plus ~475 KB brotli of WASM. IndexedDB is natively
multi-tab and would need neither. The coordinator is where both defects found by
this spike live.

Two things make that acceptable rather than damning: the coordinator is written
once and shared by editor and reader rather than paid per surface, and the WASM
is fetched by the worker, so it can be lazy-loaded behind an explicit "make
available offline" action and charged only to users who opt in.

### What would reverse this

If the agent turns out to be server-side against Postgres rather than
local-first, and offline reader search is dropped or moved server-side, then
IndexedDB is the better engineering choice — less code, fewer failure modes,
broader support — and the coordinator becomes pure cost.

### Still contingent on Safari

Safari is where OPFS and SharedWorker are most likely to behave differently, and
it is the one browser this spike could not exercise. Phase 0 should not be
declared passed until it is run.

## Not tested

- **Power loss.** The crash trials kill the renderer, not the machine, so
  `synchronous = FULL` versus `NORMAL` — and IndexedDB strict versus relaxed —
  remain unseparated. This is the only durability question still open, and the
  only one where the engines might still differ.

- **Safari ≥ 16.4 — the significant gap.** No automatable real Safari was
  available. `playwright-webkit` is not evidence. The harness is fully
  hand-drivable for exactly this reason; the verify skill has the steps. Note the
  Safari 16.4 floor is not arbitrary: it is the first Safari with module workers
  and SharedWorker together, and both are load-bearing here.
- **`navigator.storage.persist()` actually granted.** Returned `false` in both
  headless engines. Eviction protection is unverified.
- **Firefox under a real crash**, and Firefox ownership migration.
- **Real Yjs documents.** Blobs are synthetic bytes sized from the real database.
  Real docs accumulate CRDT history between compactions, so they will be larger —
  the throughput figures are an optimistic bound, not a worst case.
- **Long-running sessions.** Nothing here ran for more than a few minutes; journal
  growth and compaction over a real offline working session are untested.

## Issues for Phase 1 (DEV-562)

1. **10 s worst-case stall on ownership migration.** `CALL_TIMEOUT_MS` is the
   floor for noticing a dead owner. Either lower it, or add a liveness ping so a
   dead owner is detected without waiting for a call to time out.
2. **No recovery path when `open()` fails.** If the new owner cannot open the
   database it rejects inside the lock callback, the lock is released, no owner is
   ever elected, and every tab waits forever with no error. During development one
   run stalled in exactly this shape (not reproduced with the final code). This
   would present to a user as a silently frozen editor and needs an explicit
   failure path.
3. **One transient `SQLITE_CORRUPT` during an early migration run.** Seen once
   during a crash-under-load run, not reproduced afterwards. It surfaced as a
   thrown error, not bad data, so the loud-failure property held — but it is worth
   watching.
4. **`DebugApi` must not ship.** Destructive test-only operations; they are off
   `StorageApi` deliberately, and should be dropped or gated unless the torture
   scenarios become a permanent regression suite.
5. **Schema version skew across peers.** A browser tab refreshes instantly; a
   desktop agent updates on its own cadence. Two processes will run different
   schema versions against the same sync substrate, so the journal format and
   migrations need cross-process versioning. This constraint does not exist in a
   browser-only design and appeared only once the agent was treated as a
   local-first peer.
6. **Three-peer merge topology.** DEV-707 / DEV-709 are scoped browser↔server. A
   local agent makes conflict review N-peer: "yours / theirs" becomes "yours /
   theirs / the agent's". Not a storage decision, but it lands in the same phase.
7. **Bundler workarounds are inherited cost.** Neither the SQLite WASM package nor
   the SharedWorker entry can go through Turbopack; both are pre-built into
   `public/` by `tools/build-storage-assets.mjs`, which is a manual step that
   `nx dev` does not run. Worth wiring into the app's build target.

## Bundler findings (useful beyond this spike)

- **`@sqlite.org/sqlite-wasm` cannot be bundled.** It contains
  `new Worker(new URL(proxyUri, import.meta.url))` for the plain OPFS VFS's async
  proxy, where `proxyUri` is runtime-only. The SAH pool VFS never executes it, but
  Turbopack and webpack both fail the build on the unresolvable dynamic import.
- **Turbopack does not compile `new SharedWorker(new URL('./x.ts', …))`.** It
  handles the dedicated-worker form but emits the SharedWorker entry into
  `_next/static/media` as a _raw_ file, so the browser receives TypeScript and
  fails to parse it. The symptom is subtle: the page loads, a tab still becomes
  `owner` via the Web Lock, but `ownerId` stays `null` and cross-tab proxying
  silently never works.
- `opfs-sahpool` keeps its files in an `.opaque` subdirectory of the VFS
  directory, each a fixed-size slot with a 4 KB header. The database occupies only
  a prefix of its slot.
