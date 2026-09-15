# Saving a changed passage

The unit of write is the **passage**, not the annotation. There is no API that
adds or removes one annotation: a passage is saved with its annotations, and the
stored set is replaced by the set you send.

Use the `upsert_passage` operation — see `reference/import-model/operations.md`
for its shape and `reference/import-model/annotations.md` for the annotation
kinds it accepts.

## Send the whole annotation set

**Any annotation you leave out is deleted.** A passage that carries a dozen
glossary instances and an end-note link needs all of them in the payload, at
their post-edit offsets, or they are gone.

So editing one annotation means reading the passage's whole set, re-mapping the
offsets of the ones you did not touch (`offsets.md`), and sending everything
back together.

Two things make that round-trip lossy if you are not careful:

- **A kind with no importer is dropped silently** — no error, no warning, and
  then deleted as absent. Check your set against the importable kinds in
  `reference/import-model/annotations.md` *before* you write, not after.
- **The `deprecated-*` types cannot be round-tripped at all.** A read maps them
  to `unknown`, so their identity is already lost before you write. A passage
  carrying one cannot be saved without destroying it. Stop and tell the editor
  rather than proceeding.

## Carry the existing values through

A first-time import lets the tool fill in identifiers. **Editing an existing
passage is the opposite: supply what it already has, or you overwrite it.**

| field | if you omit it |
|---|---|
| `uuid` | a new passage is inserted beside the one you meant to change |
| `sort` | reassigned from a counter that starts at 0, reordering the work |
| `label`, `type` | rewritten to whatever you sent |

`sort` is the one to watch, because the editor does not behave this way and the
difference is easy to carry over. Editing through the editor, passages arrive
with their stored sort and keep it. On this path an omitted `sort` is filled by
a counter running from 0 over the operations you sent, which on a work of any
size rewrites a passage's position to a number far below where it belongs. The
row is then updated in place, with no reordering step to catch it.

`xmlId` is not in that list. It is a deprecated artifact of the original
migration: nothing in the reader path reads it, publishing strips it, and new
works should not have one. Passing it through does no harm and leaving it out
breaks nothing — do not spend effort preserving it.

An annotation operation may also carry a `uuid`. Send the stored one for every
annotation that already exists. Omitted, the uuid is derived from the
annotation's kind and position — so a shifted offset yields a new identity, and
the row is deleted and re-inserted rather than updated. Other rows reference
annotations by uuid.

## Inserting a new passage

A passage you are adding is the one case with no existing values to preserve. It
takes a fresh `uuid` and the `sort` you want it to occupy — **not** a gap you
found between two neighbours. Give it the `label` the convention calls for,
which is sometimes none.

The room is made for you. A passage whose `uuid` is not already stored counts as
an insert, and the save path shifts the contiguous run of passages beginning at
your `sort` up by one to open the slot. If nothing sits exactly at that `sort`
the position is already free and nothing moves; the shift stops at the first gap
either way, so it never disturbs the rest of the work.

So place a new passage by naming the sort of the passage it should come
**before**. Hunting for an unused number is unnecessary and riskier — sorts are
not required to be contiguous, and passages are allowed to share one.

This applies only to inserts. An existing passage's `sort` is written exactly as
you send it, with no shifting and no adjustment.

## A sort is a reading position, not a passage

Two passages in one work may share a `sort`, and when they do they differ by
`toh`. A single work can be catalogued under several Tohoku numbers, and those
versions are usually near-identical — a handful of passages carry the variation
and the rest are common to all of them.

So the tuple that identifies a passage is **`(work, sort, toh)`**, not
`(work, sort)`. Match the passages you read on all three. Keying on `sort` alone
silently conflates a passage with its variant under another Tohoku number, and
writing back then overwrites one with the other.

`toh` is set only where it has to be:

- **`toh` unset** — the passage belongs to every Tohoku number the work carries.
  This is nearly all of them.
- **`toh` set** — the passage is the variant for that number, and its siblings at
  the same `sort` cover the others.

Leave that scoping exactly as you found it. A `toh` you drop turns a variant into
the shared text for every version of the work; one you invent splits a shared
passage away from the versions that still need it.

Inserting at a shared sort displaces **every** variant there, because the shift
keys on the work and the sort alone. That is right — they are one reading
position — but it means an insert is a change to the whole work, not to one
Tohoku number. If you meant to add something for a single version, say so in the
preview: what you are actually doing is adding a position to all of them.

## Unchanged passages stay out of the payload

Send only the passages you changed. An unchanged passage in the payload is not
harmless: it is a full replacement of its annotation set, with every hazard
above, for no benefit.
