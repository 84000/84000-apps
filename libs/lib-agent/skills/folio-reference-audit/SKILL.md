---
name: folio-reference-audit
disable-model-invocation: true
description: Audit a work's folio references against its Tibetan source folios — a late-stage QA check that every folio of the work has exactly one correctly formed folio mention, in order and in an allowed position. Use when an editor asks to audit, check, QA or verify the folio references, folio breaks or folio mentions of a work (by Tohoku number), or asks which folios are missing. Reports missing, duplicate, foreign, out-of-order, misplaced and malformed mentions, suggests where each missing folio belongs from the passage alignments, and writes only the fixes the editor approves.
---

# Folio reference audit

By the end of the digital publication workflow, every folio of a work's Tibetan
source should be marked in the translation by exactly one folio mention, in
folio order, at the point where the folio begins. Earlier steps in the .docx
import put them there — but translators sometimes miss, skip or mislabel one.
This skill is a final QA check.

It has two halves. **The comparison is mechanical**: the folios a work should
have come from `get-translation-folios`, the folio mentions it does have are
annotations on the passages from `get-translation-passages`, and code compares
the two lists. **Placing a missing folio is judgement**: reading the Tibetan at
the folio break against the English and choosing the end of a sentence or
clause. Do not let the comparison's output stand in for the second half.

**Always do the comparison in code — a short script you write and run — even
for a short work.** Never compare the folio list and the mentions in the
conversation. A long work has hundreds of folios and passages: comparing them
by reading costs a great many tokens and miscounts, and an audit that
miscounts is worse than none. If you cannot run code in this environment, stop
and tell the editor rather than comparing by eye. The specification is under
*The comparison* below; use whatever language the environment has.

Nothing is written until the editor has read the report and approved specific
fixes.

## What counts as found

Only a finished folio mention counts. In a `get-translation-passages` result it
is an annotation with:

| field | value |
|---|---|
| `type` | `mention` |
| `linkType` | `folio` |
| `start`, `end` | equal — a folio break is a position, not a range |
| `entity` | the folio's UUID (its label comes from that folio's number and side) |
| `linkToh` | the Tohoku number being audited |
| `isSameWork` | `true` |

A folio mention with a `subtype` (`bampo` or `volume`) is a bampo or volume
marker such as `[B1]` or `[V26]`. It points at the folio it sits on but is not
that folio's break, so the audit ignores it.

A `[F.27.b]` still in the text, a `deprecated-reference`, or a folio `link` is
**not** found. Those mean an earlier step was skipped; the audit reports the
folio as missing, and the editor should run `resolve-folio-mentions` rather
than this skill's placement step. Say so if you notice them while reading.

## Where a mention may sit

- **Offset 0 only in the first passage.** A mention may sit at offset 0 only in
  the first passage of the translation (the passage with `type` `translation`
  whose `label` is `1.1` or `p.1`). There it marks the folio on which the text
  opens, which may fall inside the title — several may stack there when a text
  has a variant Tohoku number. Anywhere else, offset 0 reads badly: a break
  that falls at the start of a passage belongs at the **last index of the
  previous passage that is not a heading** — skip `translationHeader` passages
  (`start == end ==` that passage's content length).
- **End of a sentence, or of a complete clause.** A break inside a passage goes
  at the end of the sentence in which the folio turns over; in a long sentence,
  at the end of the complete clause in which it turns over. Never mid-clause.
  In verse, the end of a line that closes a clause. When the folio turns just
  short of a clause end, as it often does, the mention goes at that clause end,
  after the break — not back at the previous one.
- **After a verse number.** When the break falls at the end of a verse that
  closes with its number (`… grandeur. {2}`), the mention goes after the number:
  `grandeur. {2}‖`. Rare, but do not stop at the full stop.
- **After the closing punctuation.** Spacing around the mention does not
  matter: the editor and the reader normalise it. Do not report it.
- **End note first.** When an `endNoteLink` sits at the same offset, the note
  marker comes first and the folio mention after it. (The rare exception is a
  note that justifies the folio reference itself; such notes are added after
  the folio, so this skill will not usually meet one.)

## Workflow

### 1. Resolve the work

Run `resolve-toh` on the Tohoku number. Carry the returned `toh` and `workUuid`
forward. If `placements` lists more than one number, the work has a folio
sequence per number: audit each number separately (steps 2–4 per number), and
skip mentions whose `linkToh` is one of the other numbers rather than reporting
them as foreign.

### 2. Read the expected folios

Page `get-translation-folios` with the `toh`, `size: 50`, from `page: 0` until a
page returns fewer than 50 folios. Every folio carries its Tibetan `content`, so
these results are large: get them into files your code can read (see *Getting
the data into code*) rather than reading them in the conversation.

### 3. Read the passages

Page `get-translation-passages` with the work UUID, `includeAlignments: false`,
a large `maxPassages` and `maxCharacters`, following `nextCursor` until
`hasMoreAfter` is false. Read **all** passage types — a folio mention in an
endnote or the introduction is an error the audit should see — and get each
page into a file.

### 4. Run the comparison

Write and run the comparison described under *The comparison*. Report only what
it prints; do not add to or correct its findings by reading the data yourself.

For a `foreign` mention, look up the folio UUID with `lookup-entity` and name
it in the report (for example "F.71.a of Toh 83") — the UUID alone tells the
editor nothing.

Mentions added by hand in the studio editor currently come back with an empty
`linkToh` (and sometimes `isSameWork`); expect field warnings on those.

The comparison checks presence, order, form and position rules. It does
**not** check that a found mention sits at the right sentence. Do not claim it
does.

### 5. Suggest a place for each missing folio

For each `missing` folio, the comparison gives the found mentions on either
side and the translation passages between them. The break lies in that window:
after the earlier mention's offset in its passage and before the later
mention's offset in its passage.

Start with the alignments. Calling `get-passage-alignments` and getting no
alignments back (everything under `unaligned`) is how you learn the work has
none yet; then use the fallback.

**With alignments.** Call `get-passage-alignments` with `passageUuids` set to
the window's passages, the `toh`, and `includeEnglish: true`. These are the
recorded alignments: the Tibetan span behind each passage, with the folio
markers inline. Two signals locate the break:

- An inline marker in an alignment's `tibetan`: `…མདུན་དུ་བདར་ཏེ་ལྷན་[F.27.b]ཅིག་ཏུ།…`.
  The break is inside that passage, at that point in the Tibetan. This is the
  strong signal.
- The `folioUuid` changing between consecutive alignments. With no marker, the
  folio begins at the start of the first alignment on it, so the mention goes
  at the last index of the previous non-heading passage.

Some passages in an aligned work may have no alignment (they come back under
`unaligned`). If the break could fall in one of them, use the fallback below
for that stretch.

Then map the Tibetan to the English. Identify what the Tibetan says up to the
break, find where the English has rendered it, and choose the end of the
sentence or clause that completes it. English word order often differs from
the Tibetan — in verse the translator may reorder lines — so the folio may turn
mid-line in Tibetan with no exact English counterpart. Match on the Tibetan
pāda or clause that contains the break, and in verse place the mention at the
end of the English line(s) that render it. Look at how the found mentions in
the same work sit and follow that precedent. When two places are defensible
(the end of a short clause and the end of the sentence), give the better one
and name the other as an alternative. If the logical place is offset 0 of a
passage (other than the first), suggest the last index of the previous
non-heading passage instead.

**Without alignments.** Alignments are generated late, so an editor may run
this audit before they exist; `get-passage-alignments` then returns nothing for
the window. Fall back to each folio's Tibetan `content` from
`get-translation-folios`. You read it in step 2; use those results if you still
have the `content`, otherwise fetch the missing folio and the one before it
(`folioUuid: <missing folio>`, `before: 1`, `after: 0`). Read the seam — the
last physical line or two of the previous folio and the first line or two of
the missing one (lines are separated by `\n` in `content`). The folio usually
turns mid-word and mid-pāda; the unit to match is the pāda or clause that
contains the break. Translate the seam for yourself, then read the English of
the window passages to find where it is rendered. The window is already
narrowed by the neighbouring found mentions, so you are matching a few lines of
Tibetan against a few passages, not the whole work. Apply the same placement
rules. These suggestions are weaker: **low** by default, **medium** at most,
and only when the seam is distinctive (a name, a number, a verse count) and the
English unmistakable. Quote the Tibetan seam and your rough rendering of it so
the editor can check. The observation check below needs alignments; without
them, say that the found mentions' positions were not checked.

For each suggestion record: the passage label and UUID, the offset, the English
context with the break shown (`…noblemen,‖ He departed…`), the Tibetan around
the break, the confidence (**high**: inline marker and a clear English
counterpart; **medium**: marker or folio boundary, but the English is
reordered or loose; **low** or **medium**: no alignments, see above), and one
sentence of reasoning.

Check your offset against the passage `content` before reporting it: compute
it in code, do not estimate it. The character before it should be the closing
punctuation (or the verse number's closing brace). If an `endNoteLink` already
sits at that offset, the note comes first: say so in the suggestion, and after
applying ask the editor to confirm in the studio that the note marker renders
before the folio.

The alignments you read here also show the markers for the found mentions in
the window. If one plainly disagrees with where its mention sits — the marker
falls a sentence later, say — report it as an **observation**, separate from the
errors, with both offsets. Do not go looking for these outside the windows you
already read.

### 6. Report

Lead with the totals the comparison printed (folios expected, mentions found,
errors, warnings, passages read), so the editor can see it ran. Then the
errors, each with what it means and the proposed fix; then the suggestions
from step 5; then the warnings. Nothing has been written at this point — say
so.

Proposed fixes, by kind:

| kind | fix |
|---|---|
| `missing` | add a mention at the suggested offset |
| `duplicate` | keep the one in the right place, remove the others |
| `foreign` | remove, and add the folio that belongs there if one is missing nearby — never guess which |
| `out-of-order`, `offset-0` | remove and re-add at the correct place |
| `malformed` | remove and re-add as zero-length at its `start` |
| `toh-field`, `same-work-field` | remove and re-add with the fields set |

Ask the editor which to apply. They may want to verify a suggestion against the
source first; that is the point of the report.

### 7. Apply approved fixes

Use `apply-passage-edits`, offsets in the stored passage coordinates, all edits
to a passage in one call. It has no way to order two zero-length annotations at
the same offset, so where a folio joins an end-note marker, ask the editor to
confirm the order in the studio afterwards.

- add: `{ op: "add-annotation", passageUuid, kind: "mention", start, data: { entity: <folio uuid>, linkType: "folio", isSameWork: true, linkToh: <toh> } }` — no `end`;
- remove: `{ op: "remove-annotation", passageUuid, annotationUuid }`.

Run with `dryRun: true` first and show the editor the result; write only when
they confirm. Never edit text in this skill: a mistyped marker left in the
text is reported for the editor to correct.

### 8. Verify

Re-read the passages and run the comparison again. The applied errors should be
gone, the count of found mentions should match, and anything the editor
declined should still be reported.

## The comparison

Read-only and deterministic. Write it once per run; keep it short.

**Inputs**

- *Folios* — every page from step 2, concatenated in page order. Keep each
  folio's `uuid`, `volume`, `folio` and `side`; its label is `F.<folio>.<side>`.
  This order is the expected order.
- *Passages* — every page from step 3, de-duplicated by `uuid` and sorted by
  `sort`. Keep `uuid`, `label`, `type`, `sort`, `content` and `annotations`.
- The `toh` being audited, and any sibling Tohoku numbers (step 1).

**Found mentions.** Walk the passages in order and, within a passage, the
annotations by `start`. Take every annotation with `type` `mention` and
`linkType` `folio` and no `subtype`; skip those whose `linkToh` is a sibling
number.

**Checks**, in this order for each mention:

| kind | level | rule |
|---|---|---|
| `malformed` | error | `start ≠ end`. Not counted as found; check nothing else on it. |
| `foreign` | error | `entity` is not a folio UUID in the list. Check nothing else on it. |
| `toh-field` | warning | `linkToh` is not the audited `toh` |
| `same-work-field` | warning | `isSameWork` is not `true` |
| `outside-translation` | error | the passage's `type` is not `translation` |
| `offset-0` | error | `start == 0` and the passage is not the first translation passage (label `1.1` or `p.1`). Give the target: the nearest earlier passage of `type` `translation` (so headings are skipped), at its `content` length. |

If the work has no translation passage labelled `1.1` or `p.1`, stop and ask
the editor which passage opens the translation.

Then, over the mentions that passed `malformed` and `foreign` (mentions flagged
`outside-translation` or `offset-0` still count as found here):

| kind | level | rule |
|---|---|---|
| `missing` | error | a folio in the list has no mention. Give the found mentions of the nearest folios before and after it in the folio list (folio label, passage label and UUID, offset), and the UUIDs of the `translation` passages between those two passages, inclusive. With no folio found before it, the window starts at the first translation passage; with none after, it runs to the last. |
| `duplicate` | error | a folio has more than one mention; list each (passage label, offset, annotation UUID). |
| `out-of-order` | error | in reading order, a mention's folio comes earlier in the list than the previous mention's folio. |

**Output.** Print one line of totals — folios expected, mentions found,
errors, warnings, passages read — then each finding with its kind, the folio
label, the passage label, the offset, the annotation UUID, and for every
mention a short context: up to 60 characters of `content` before the offset,
`‖`, up to 40 after. Keep the full result (including the `missing` windows) in
a file for steps 5–8.

**Sanity checks.** Folio UUIDs must be unique across the pages (if not, a page
was read twice). The passages read must equal what the pages returned. If
either fails, stop and say so.

## Getting the data into code

Your code needs the step 2 and 3 results as files. A result the client saved
to a file because it was too large to show can be read as it is: it is a JSON
array of `{type, text}` items, the tool's JSON in the first `text` that parses,
possibly followed by a notice from the studio that is not JSON.

When a result comes back inline instead, write it to a file before running the
comparison:

- **Folios:** write only `toh` and each folio's `uuid`, `volume`, `folio` and
  `side`; leave the Tibetan `content` out. Copy the UUIDs exactly — a mistyped
  one shows up as a missing folio and a foreign mention.
- **Passages:** do not abridge `content` — the `offset-0` target and the
  context snippets read it. Ask for a page large enough that the client saves
  it to a file rather than retyping it.

## Limits

- The audit verifies that each folio has one well-formed mention in an allowed
  position. Whether a found mention sits at the right sentence is a reading of
  the source; check it against the alignment marker only when the editor asks.
- It reads the draft, so it audits the work as it stands in the studio, not as
  published.
- It does not convert `[F.x.y]` text; that is `resolve-folio-mentions`.
