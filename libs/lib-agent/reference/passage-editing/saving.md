# Saving a changed passage

Use **`apply-passage-edits`**. You send what you want changed and it works out
the consequences: the offsets of every other annotation on those passages, the
annotations you did not mention, the content, the sort of a passage you insert.

`apply-entity-import` is the other tool, and it is for filling a work that has
no passages yet. It takes a passage's whole end state, which on a populated work
means reconstructing everything you are not changing — see _Why not the import
tool_ below.

## The edits

| op                  | what it does                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `delete-text`       | cuts `start`–`end` out of the passage content; `text` must be exactly what that range holds |
| `add-annotation`    | adds an annotation of `kind` at `start` (and `end`, if it spans)                            |
| `remove-annotation` | removes the annotation with that uuid                                                       |
| `insert-passage`    | inserts a passage before an existing one                                                    |

`delete-text` refuses the whole call when its `text` is not what the stored
passage holds at `start`–`end`. Copy it from the passage you read.

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
  else. If that surprises you, your edit was wrong;
- one whose range was **already** outside the passage is left as stored, with a
  warning: there is no right place to move it to.

An `add-annotation` identical to one already there — same kind, same position,
same data — is skipped with a warning, so sending the same add twice is safe. The
annotation's uuid is derived from its passage, kind, position and data, so the
same add sent twice, even by two calls at once, is written as one row — unless
an identical annotation from an earlier add has since been moved, on this
passage or to another, when the new one gets a uuid of its own and the moved
one stays where it is.

Read `offsets.md` for why this is the part worth getting right.

## Preview with `dryRun`

`dryRun: true` computes the result and returns it without writing. That is the
preview: the content as it would stand, the annotation counts, and any warnings.
Show the editor that, not a description of your intentions. See `preview.md`.

## What a write guarantees

A write is **all or nothing**: the content, every annotation and any label the
insert renumbers land together, or none of them do. The result says which:

- **`applied: true`** — written.
- **an error that begins `applied: "unknown"`** — the write may have landed,
  but its answer was lost. **Re-read the passages with `get-passage` and compare
  them with what you sent before you issue anything again.** Send only what is
  missing.
- **any other error** — nothing was written. Fix what it names and send the
  call again.

With `dryRun`, the result says `applied: false`: nothing was written.

The tool never retries for you. After `"unknown"`, do not resend the same call
blindly:

- a repeated `delete-text` is usually refused, because its `text` is gone — but
  not always: cutting one "x" out of "xx" leaves an "x" at the same offsets;
- a repeated `insert-passage` inserts a second passage. Inserts are never
  treated as duplicates, because two identical neighbours can be deliberate.

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
tool only to fill a work that has no passages, or to re-run an import that
failed partway.

## Re-running an import

A large `apply-entity-import` is saved in chunks, so it is not all or nothing: a
failure partway leaves the earlier chunks written, and the error says how many
passages were saved.

**Send the same operations again.** A passage sent without a `uuid` gets one
derived from the work and its position (its `docx-<sort>` xmlId), and an
annotation sent without one gets one derived from its passage, kind, range and
data. A re-run therefore updates the rows the failed run saved instead of adding
them a second time, and ends with the rows one clean run would have written.

If the operations changed between runs, the re-run still matches by position. A
shorter run leaves the passages past its end in place, and the result warns
about them by xmlId. If an edit has moved a passage the earlier run saved out
of order among this import's passages, the re-run is refused and nothing is
written. A passage pushed down by an insert, or by the earlier run's own
placement, still matches. The check compares the import's passages with each
other, so it misses a move when only one of them is stored, or a move past
passages this import does not send: to rewrite one passage, send its stored
uuid. An annotation an edit moved to another passage is never taken from it:
the re-run saves its own copy under a new uuid and warns.

A uuid the tool derives never repeats one you sent, so passages and annotations
with and without uuids can be mixed. A work imported before uuids were derived
cannot be matched, so a re-run over it is refused rather than adding its
passages a second time; send the stored uuids to rewrite those passages.

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

They are kept verbatim through an edit, moved exactly with your cuts like any
other annotation, and written back as they were. You do not need to do anything
about them, and you do not need to avoid a passage that has one. If you
deliberately want one gone, remove it by uuid like any other annotation.

One of them is worth knowing about: `deprecated-temp-mention` holds content in
exactly the shape of a folio mention. Those are not folio mentions and a reader
does not render them as such.
