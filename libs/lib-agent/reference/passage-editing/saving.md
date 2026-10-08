# Saving a changed passage

Use **`apply-passage-edits`**. You send what you want changed and it works out
the consequences: the offsets of every other annotation on those passages, the
annotations you did not mention, the content, the sort of a passage you insert.

`apply-entity-import` is the other tool, and it is for filling a work that has
no passages yet. It takes a passage's whole end state, which on a populated work
means reconstructing everything you are not changing — see *Why not the import
tool* below.

## The edits

| op | what it does |
|---|---|
| `delete-text` | cuts `start`–`end` out of the passage content |
| `add-annotation` | adds an annotation of `kind` at `start` (and `end`, if it spans) |
| `remove-annotation` | removes the annotation with that uuid |
| `insert-passage` | inserts a passage before an existing one |

`add-annotation` without `end` makes a zero-length marker, which is what a folio
mention or an end-note link is. See `reference/import-model/annotations.md` for
the kinds and the `data` each one needs; a kind with no importer is refused
outright rather than silently dropped.

## Offsets are read in the stored coordinates

**Every offset you send is a position in the passage as it is stored now**,
before any edit in your list is applied. You do not adjust for your own edits.

Cut a nine-character marker at 14 and add a mention at 14, and the mention lands
where the marker was; a glossary instance at 30 moves to 21 without you saying
so. Several edits on one passage are fine and order does not matter.

What the tool does with the annotations you did not name:

- one **before** the cut stays where it is;
- one **after** it moves back by what was removed;
- one that **spans** the cut keeps its start and loses the cut from its end;
- one whose text was **entirely** deleted is dropped, with a warning naming it —
  keeping it would turn a range into a zero-length marker, which means something
  else. If that surprises you, your edit was wrong.

Read `offsets.md` for why this is the part worth getting right.

## Preview with `dryRun`

`dryRun: true` computes the result and returns it without writing. That is the
preview: the content as it would stand, the annotation counts, and any warnings.
Show the editor that, not a description of your intentions. See `preview.md`.

## Inserting a passage

`insert-passage` takes the passage it goes **before** and adopts that passage's
sort; the save path shifts the run beginning there to open the slot. Do not hunt
for an unused number — sorts need not be contiguous and passages may share one.

`label` defaults to none and `type` to the anchor's type.

## Why not the import tool

`apply-entity-import` replaces a passage's stored annotations with the set you
send, so on a populated work you would have to re-send every annotation you were
not changing, at offsets you had re-mapped yourself, along with the passage's
existing `uuid`, `sort`, `label` and `type`. Anything you omitted would be
deleted or overwritten.

That is what `apply-passage-edits` exists to do for you. Reach for the import
tool only when the work has no passages at all.

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

## Legacy annotations are preserved, not lost

Some passages carry `deprecated-*` annotations — around 23,000 rows across the
library, left by earlier migrations. They have no domain model, so a read cannot
say what they are beyond "unmodelled".

They are kept verbatim through an edit and written back as they were. You do not
need to do anything about them, and you do not need to avoid a passage that has
one. If you deliberately want one gone, remove it by uuid like any other
annotation.

One of them is worth knowing about: `deprecated-temp-mention` holds content in
exactly the shape of a folio mention. Those are not folio mentions and a reader
does not render them as such.
