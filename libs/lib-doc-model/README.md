# @eightyfourthousand/lib-doc-model

The per-passage document model: one small Yjs document per passage, a work-level
spine holding order and identity, structural operations over the two, and the
exporters that turn a passage document back into a `passages` row.

The work is split in two:

- **One document per passage.** Content and annotations for a single passage,
  created on demand and released when it leaves the visible window. Annotations
  are not stored separately: they are the marks and node attributes on the
  content, which is how the exporters read them, and a second home for them
  would be a second thing to reconcile on merge.
- **One spine per work.** Ordered passage uuids, plus each passage's label,
  type, and tab assignment.

Memory is bounded by the window rather than by the work.

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

## Undo

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

## Hydration

`PassageLoader` takes an ordered list of `PassageSource`s and asks each only for
what the ones before it could not supply local first, then GraphQL. Anything a
later source answered is written back through the loader's `cache`.

A source that throws is logged and skipped rather than failing the window: a
corrupt local cache should fall through to the network, not leave a blank page.
Passages no source could supply are reported in `LoadReport.missing` rather than
silently omitted.

`WorkDocument.hydrateWindow` is the whole memory story in one call — hydrate the
range plus the loader's buffer, release everything outside it. Releasing refuses
while a passage is dirty: a released document is gone, and unsynced edits are the
one thing this model cannot re-fetch.
