---
name: resolve-folio-mentions
description: Turn the folio break markers in a work's passages into folio mention annotations. Use when an editor wants the `[F.123.a]` markers in a translation — left as plain text, wrapped in a deprecated reference, or imported as an ordinary link — converted into the zero-length `mention` annotations the reader renders as folio breaks. Reads the work by Tohoku number, resolves each marker to a folio UUID, shows a preview for review, then writes through the passage save.
---

# Resolve folio mentions

A folio break is **not** text. In a finished work the marker text is gone from
the passage content and a zero-length `mention` annotation sits at the offset it
occupied, pointing at the folio's UUID. The reader regenerates the `[F.123.a]`
label from the folio it points at, which is why leaving the text in place would
double it.

This skill performs that conversion on a work whose markers are still text.
Almost none of it is mechanical: deciding what is a folio break and what merely
looks like one, and deciding where the first one belongs, is the work.

## What a finished folio mention looks like

One `passage_annotations` row per break:

| column | value |
|---|---|
| `type` | `mention` |
| `start`, `end` | **the same number** — the offset in `content` where the break falls |
| `content` | `[{"uuid": "<folio uuid>"}, {"type": "folio"}, {"same_work": true}, {"toh": "toh58"}]` |

Zero-length is the point: the annotation marks a position, not a range. `start`
and `end` must be equal, and they are **not** always `0` — a break falling
mid-paragraph carries that paragraph's offset.

The `toh` inside `content` is the *target's* Tohoku number. It is a different
field from the row's own `toh` column, which scopes visibility; do not conflate
them.

## Workflow

### 1. Resolve the work

Run `resolve-toh` on the Tohoku number first. A cited number is often not a
catalog entry, and every folio read keys on the catalogued number. Carry the
returned `toh` forward — it is the `toh` the mentions carry, and because folios
are keyed by source text, it is what makes a folio number resolvable at all.

### 2. Build the folio index

Page `get-translation-folios` over the work and keep each folio's `uuid`,
`folio`, `side` and `volume`. You need the whole list before you start: markers
resolve against it, and you cannot tell a missing folio from a mis-read marker
without it.

Where a folio number recurs across volumes, the volume disambiguates. Resolve in
reading order and the volume follows from the preceding folio.

### 3. Find the candidates

Read the passages with `get-translation-passages`. A break marker turns up in one
of three states:

- **Plain text** in `content`: `[F.90.a]`.
- **Wrapped in a `deprecated-reference` annotation** covering exactly that text.
  This is the usual state of an older work.
- **An ordinary `link` annotation** whose `href` is
  `https://84000.co/entity/folio/<folio uuid>?tab=source&toh=<toh>`. Imports
  produce these — `docx-import` records that it cannot correct internal link
  targets. Here the folio UUID is already in the `href`: take it rather than
  re-resolving, and delete the link.

### 4. Sort the candidates three ways: convert, ask, reject

Most bracketed text in the corpus is not a folio marker, and a
`deprecated-reference` annotation is not a folio signal — across the library
fewer than one in twenty of them is a break. But the boundary is not clean, and
**an unsure case goes to the editor, not to the discard pile.** Skipping looks
safe and is not: it buries the evidence that the case exists.

**Convert** `[F.<number>.<a|b>]`, the bracket closing immediately after the side.

**Ask** about a folio reference carrying a third dot-segment —
`[F.162.a.6]`, `[F.163.b.4-5]`. The trailing number is a line on the folio. These
are folio references written against convention rather than a different kind of
thing, so they should become mentions too; what makes them worth raising is that
the line number has nowhere to go. A folio mention points at a folio, so
converting one drops the `.6`, and the reader will render `[F.162.a]` where the
translator wrote `[F.162.a.6]`. Show the editor each one with the line number it
would lose and let them decide.

**Reject** text that is not a folio reference at all:

| looks like | what it is |
|---|---|
| `{TK12}`, `{V9}`, `{1.10}` | milestone markers |
| `[B1]` … `[B10]` | bampo divisions |
| `[1]`, `[100]`, `[A]` | numbering |
| `[and so forth]`, `[the teachers]`, `[sic]`, `[…]` | translator interpolation |

Anything else shaped like a folio reference but malformed — a side that is not
`a` or `b`, a number outside the work's folio range, a bracket that does not
close — is an **ask**, not a reject. Reserve rejection for text that is
definitely something else.

### 5. Lift the first reference into its own passage

The **first** folio reference in the work is a special case, and only the first.

If it sits at the **beginning of the passage it currently occupies** — possibly
alongside other square-bracketed text — move it into a **new, label-less passage
inserted immediately before that passage**. Whatever bracketed text sat beside it
comes along on the same line: the new passage's content is that text, with the
zero-length mention at offset 0.

In practice this lands between the body-title passage, whose label is `1.` and
which reads as the title, and the first content passage.

```
passage 1.    "The Noble Great Vehicle Sūtra…"      ← body title, untouched
passage ""    "[B1]"                                 ← new, no label
              mention 0/0 → F.237.a
passage 1.1   "Chapter 13 of the one-hundred-…"      ← marker removed from the front
```

Both conditions carry weight. If the first reference is **not** at the start of
its passage, leave it where it is and treat it like any other marker. Every
reference after the first is an ordinary marker regardless of where it sits.

Give the new passage a `sort` between the body-title passage and the one it
precedes, and do not give it a label.

Published works will often disagree with this rule — an older migration left
their first mention at offset 0 of the first labeled passage, with no marker
anywhere. That is an artifact, not the convention. Do not imitate it, and do not
treat it as evidence you have mis-read a work.

### 6. Remove the marker and re-map the offsets

This is where the conversion goes wrong if you are careless. Deleting
`[F.90.a] ` removes nine or ten characters from `content`, so **every annotation
on that passage that starts after the marker shifts back by that many
characters.** A mention placed correctly beside glossary instances and end-note
links left at their old offsets is a broken passage.

For each passage, working through its markers **right to left** so the offsets
you have not reached yet stay valid:

1. Note the marker's start offset.
2. Cut the marker text, and the single space that usually trails it, out of
   `content`. Do not leave a double space, or a space before punctuation.
3. Drop the `deprecated-reference` or `link` annotation that covered it.
4. Shift every remaining annotation on the passage: any `start` or `end` past
   the cut moves back by the number of characters removed. An annotation that
   spanned the marker gets shorter; one entirely before it does not move.
5. Add the `mention` at the noted offset, with `start` and `end` equal.

### 7. Preview before writing (required)

Show the editor: how many mentions will be created; what happened to the first
reference and why; **every candidate you are unsure about**, each with the reason
it is doubtful and what converting it would cost; every candidate you rejected;
any folio number that did not resolve; and any gap in the folio sequence.

Do not write until the editor confirms, and do not resolve an ask by choosing for
them. The doubtful cases matter more than the clean ones — a gap in the sequence
usually means a marker was missed rather than a folio missing, and a reference
you quietly passed over is one nobody will find again.

### 8. Apply through the passage save

Write with the entity-import `upsert_passage` action, one operation per passage
you changed. The passage is the unit of write: annotations are saved as a set,
so the operation carries the passage's **complete** annotation list, not just the
new mentions. Anything you leave out is deleted.

That means echoing back every annotation you did not touch, at its shifted
offset. Carry through the passage's existing `uuid`, `label`, `sort`, `type` and
`xmlId` unchanged — `xmlId` in particular, because passages reference each other
by it and an omitted one is silently replaced.

The new first-folio passage is the one exception: it is an insert, so it needs a
fresh `uuid` and a `sort` that places it correctly, and its label stays empty.

### 9. Verify

Re-read the passages and check that:

- no `[F.<n>.<side>]` text remains, and every reference the editor declined still does;
- the mention count matches the preview;
- every mention has `start == end`;
- the annotations around a converted marker still cover the text they used to —
  spot-check a glossary instance or an end-note link near a break, since a
  mis-shifted offset reads as a subtly wrong word rather than an error.
