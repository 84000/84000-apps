# @eightyfourthousand/lib-doc-model

The per-passage document model: one small Yjs document per passage, a work-level
spine holding order and identity, structural operations over the two, and the
exporters that turn a passage document back into a `passages` row.

Built for [DEV-564](https://linear.app/84000/issue/DEV-564), from the model the
[DEV-706](https://linear.app/84000/issue/DEV-706) prototype validated. It has no
`package.json` because it is not published — it is consumed inside this monorepo
via the `@eightyfourthousand/lib-doc-model` path alias.

## Why it is sharded

The model it replaces held one Yjs document per editor tab, covering a whole
work. Some texts in the canon run to thousands of pages, and hydrating one of
those into memory to edit a paragraph is not viable — the cost of opening a work
scaled with the work rather than with what the reader could see.

So the work is split in two:

- **One document per passage.** Content and annotations for a single passage,
  created on demand and released when it leaves the visible window. Annotations
  are not stored separately: they _are_ the marks and node attributes on the
  content, which is how the exporters read them, and a second home for them
  would be a second thing to reconcile on merge.
- **One spine per work.** Ordered passage uuids, plus each passage's label,
  type, and matter assignment — a handful of short strings per passage, small
  enough to hold for the whole session. Ordering, labelling, navigation and the
  table of contents all read the spine and open nothing.

Memory is then bounded by the window rather than by the work, by construction.

## Why it is environment-agnostic

Two callers need this model and only one of them is a browser:

- The editor stack mounts a TipTap instance per passage over these documents.
- The server-side passage write service
  ([DEV-713](https://linear.app/84000/issue/DEV-713)) applies agent, docx-import
  and version-restore writes to the same documents from a Next.js route handler,
  and materializes rows through the same exporters.

If the two used different code they would drift, and the thing they would drift
on is how a structural op renumbers labels — which is exactly what makes a work
look corrupted. So nothing here touches a browser API, imports an editor, or
knows where a passage is stored.

Two consequences to be aware of:

- **The ProseMirror schema is injected.** The browser's extension set has React
  node views and the SSR set does not, so this package takes a `Schema` rather
  than building one. Pass `getSchema(buildStackSchemaExtensions())` in the
  browser, `getSchema(translationSSRExtensions)` in a route handler.
- **Browser globals are banned by lint, not by types.** `data-access` is
  compiled from source and transitively needs the DOM lib, so `dom` has to stay
  in `tsconfig.lib.json`. `eslint.config.mjs` restricts the globals instead.

## The pieces

| Module                          | What it is                                                                  |
| ------------------------------- | --------------------------------------------------------------------------- |
| `Spine`                         | The work-level Yjs document: order, labels, types, matter. All renumbering. |
| `PassageDoc`                    | One passage's Yjs document, its undo manager, and its dirty flag.           |
| `PassageDocStore`               | The set of documents currently in memory; hydration and release.            |
| `WorkDocument`                  | Spine + store + command log, and the structural operations over them.       |
| `CommandLog`                    | Interleaved undo history for text edits and structural ops.                 |
| `PassageLoader`                 | Resolves a window of passages, cheapest source first.                       |
| `exporters/`, `passageFromNode` | Row materialization, carried over unchanged.                                |

## Both directions of the row transform

`block.ts` and `transformers/` moved here alongside the exporters, and the pair
is the reason: they are inverses, `round-trip.spec.ts` tests them as one
contract, and splitting them across two packages would have put that contract on
a package boundary.

The forcing argument was the server. `blockFromPassage` is how a passage
document is re-seeded from its row — the path DEV-713 needs for agent writes,
docx import, and corruption recovery — and it was reachable only through
`lib-editing`'s barrel, which is a React component library. `api-graphql`'s
passage field resolver already imported it from there. Now both directions sit
in a package a route handler can import outright.

`transformers/` is not exported from this barrel, matching what `lib-editing`
did: only `blockFromPassage` and `blocksFromTranslationBody` are public, and
`lib-editing` re-exports those two so its own consumers are unaffected.

## Undo

Two histories, one order.

**Text edits** live in each passage's own `Y.UndoManager`. Nothing else can undo
them, and releasing a passage's document releases its text history with it —
that is the trade the windowed model makes.

**Structural operations** cannot live in any single passage's history, because a
split changes two documents and the spine. They go in the command log, which
records _what changed_ rather than a snapshot of the work: the passages touched,
the positions taken and vacated, and the labels rewritten. A snapshot of a
ten-thousand passage spine per operation would be unaffordable; a command's size
is set by the operation instead.

The two interleave in one log, so typing in passage 4, splitting passage 7, then
typing in passage 9 undoes in that order rather than in three separate orders.

## Labels

A label is a dotted numeric path (`"1"`, `"1.5"`, `"2.3.1"`). Renumbering is
`renumberLabelsFrom`, a pure function over a list of labels — it replaced
`normalizeLabelsAfter`, which walked the editor document and rewrote node
attributes.

Two properties are worth knowing:

- It stops as soon as a label already holds the value it would be given, so a
  split near the top of a long work does not rewrite every label below it.
- It never touches its own anchor, which is why `Spine` forces the label at the
  anchor position before renumbering after a removal or a move. Deleting the
  first passage of a work promotes the second, which still reads `"2"`;
  renumbering from that stale anchor would leave the whole work off by one. The
  label a _position_ holds survives a reshuffle of the passages under it, so
  restoring it makes the rest fall into place.

## Hydration

`PassageLoader` takes an ordered list of `PassageSource`s and asks each only for
what the ones before it could not supply — local storage first
— local storage first, GraphQL last.
Anything a later source answered is written back through the loader's `cache`.

A source that throws is logged and skipped rather than failing the window: a
corrupt local cache should fall through to the network, not leave a blank page.
Passages no source could supply are reported in `LoadReport.missing` rather than
silently omitted.

`WorkDocument.hydrateWindow` is the whole memory story in one call — hydrate the
range plus the loader's buffer, release everything outside it. Releasing refuses
while a passage is dirty: a released document is gone, and unsynced edits are the
one thing this model cannot re-fetch.

## What is not here yet

- Sync. `PassageDoc` encodes and applies updates and knows whether it is dirty,
  but nothing sends them. That is
  [DEV-565](https://linear.app/84000/issue/DEV-565).
- Concrete `PassageSource` implementations. The interface is here; the local
  one lands with `@eightyfourthousand/lib-persistence`, the remote one with the
  GraphQL client.
- The editor integration. `lib-editing`'s single-document editor, including
  `normalizeLabelsAfter` and `EditorProvider`'s fragment-scanning dirty
  observer, is untouched and still in use; it is replaced in
  [DEV-710](https://linear.app/84000/issue/DEV-710).
