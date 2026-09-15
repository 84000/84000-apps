# Annotation offsets

Every annotation is a range over its passage's `content`: `start` inclusive,
`end` exclusive, both character offsets into that string. They are not
bookkeeping. A `link` takes its display text from `content.slice(start, end)`, a
`span` styles exactly that range, and a `glossary-instance` claims exactly those
characters are the term. Wrong offsets are wrong content.

An annotation covering the whole passage runs from `0` to the content length.

## Zero-length annotations mark a position

When `start` and `end` are equal the annotation marks a point between two
characters rather than a range of them: a folio break, an end-note marker, a
leading space. They carry no text of their own — the reader renders them from
whatever they point at.

They are the easiest thing to place wrongly, because an off-by-one is invisible
in the diff and obvious in the reading room.

## Editing content moves the annotations after it

**This is where a passage edit goes wrong.** Cutting or inserting text in
`content` shifts every offset past the edit by the number of characters you
changed. An annotation left at its old offset does not error — it silently marks
different words.

For one edit at `at`, having removed `n` characters:

- an annotation entirely **before** `at` does not move;
- an annotation entirely **after** it moves back by `n`, both ends;
- one that **spans** the cut keeps its `start` and loses `n` from its `end`;
- one whose whole range sat **inside** the cut is gone — drop it rather than
  collapsing it to zero length, which would turn a range annotation into a
  position marker that means something else entirely.

Insertion is the same in reverse.

## Several edits in one passage

Work through them **right to left**, highest offset first. Each edit invalidates
every offset after it, so descending order keeps the ones you have not reached
yet correct and spares you a running adjustment you can get wrong.

## A zero-length annotation exactly at the boundary

When a position marker sits exactly where you are cutting, no rule decides for
you whether it belongs before or after the cut. Decide deliberately, and say
which you chose in the preview. Two markers at the same offset — an end-note
link and a folio break commonly collide — keep their relative order only if you
preserve it explicitly.

## Verify by re-slicing

After an edit, take each annotation that carries text and check that
`content.slice(start, end)` is still what it marked before. It is a cheap check
and it catches the whole class. A mis-shifted offset reads as a subtly wrong
word, not as an error, so nothing else will catch it for you.
