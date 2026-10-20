# Document structure and apparatus

## Before assembling

### The scope

Whole text or folio range, as established under _Scope_ in `SKILL.md`. Every
section below covers the scope and nothing outside it.

### The title

**For a whole-text draft, or a range draft that begins at the start of the
text**, establish the title **from the Tibetan source text itself** before
assembling anything: its own opening
title statement (typically "In the language of India: … In the language of
Tibet: …", given in the `[ti]` passage) or, for a text that opens without one,
its closing colophon title.

Translate that source-given title (Sanskrit and Tibetan, where both are given)
into English following `translator-guidelines/IV.D-text-titles`, and use that English
rendering — **not the studio catalog's `mainTitle`** — as the title of both
deliverables.

If the source-derived title differs materially from the catalog's `mainTitle` or
from the title recorded in Stage 0, do not silently prefer one: use the
source-derived title as instructed here, and flag the discrepancy both as a note
and as an open question for the editor.

**For any other range draft**, use the title recorded in the Stage 0 record. Do
not re-derive it from the source. If an earlier Stage 1 draft of the work gives
a source-derived title that differs from it, use the Stage 0 title and flag the
difference in Open questions.

### The header block

At the head of both deliverables, before Open questions:

- the title;
- the Toh number;
- the scope — `Whole text`, or `Folio range F.12.a–F.20.b` — and, for a range
  draft, exactly where the draft begins and ends, per _Range boundaries_ in
  `SKILL.md`;
- the witnesses, per `shared-policies/stok-consultation`, defining the sigla
  used in the notes: D, the Degé, as base text; and S, the Stok Palace
  witness, consulted for substantive variants (rKTs number, volume, folio
  range, rKTs eText) or not consulted, with whether that was the translator's
  answer or the default; and, where the Stok Palace version was consulted, the
  kinds of difference not noted.

## The structure, in this order

### 1. Open questions for the editor

Placed **first**, immediately after the header block and before the Summary, so
the editor sees the global issues requiring a decision before reading the
translation. A short list of the global or structural decisions the editor must
make — the rendering of a pervasive term, the treatment of a structural anomaly,
a title discrepancy — plus a pointer to any `[??]` items needing adjudication.
For a range draft, only the questions arising within the range.

Where the Stok Palace version was consulted, add what
`shared-policies/stok-consultation` routes here: any boundary findings,
missing folios or unmatched stretches, and the `[??]` variant notes awaiting a
decision.

This is the one section about the draft as a whole. Everything specific to a
point in the translation belongs in a footnote there instead.

### 2. Summary

One short paragraph, following house conventions. For a range draft, it
summarizes the content of the range only, and says that it does.

### 3. Translation body

**English only.** The source Tibetan is not reproduced in the body, in Uchen or
in Extended Wylie, and the English is not set against the Tibetan passage by
passage. Wherever Tibetan is quoted outside the body — in a footnote, the
Terminology Notes or Open questions — it is in Extended Wylie only.

**Layout** follows `translator-guidelines/IV.H-content-layout-and-folio-markers`:
paragraphs broken according to changes in theme, by modern Western convention;
verse presented line by line, with a manual line break for each line, and
broken into stanzas appropriate to the original. Where the text is **entirely
in verse**, number the stanzas in Arabic numerals enclosed in square brackets
at the end of each verse, restarting from 1 for each chapter. In a range draft
that begins partway through a chapter, count from the beginning of the chapter,
not from the beginning of the range, counting the stanzas in the retrieved
source from the chapter's start.

**No passage numbers.** Do not number paragraphs or passages. This does not
affect IV.H's own numbering — headings, and stanza or verse numbers where IV.H
calls for them.

**Folio markers** follow IV.H. Insert the Degé folio number in square brackets
at each folio break, preceded by F and followed by .a for recto or .b for
verso — `[F.45.b]` — at the point in the English that corresponds to the break
in the Tibetan. Locate each break from the folio-tagged source returned by
`get-translation-folios`. Apply IV.H's placement rules exactly:

- where the break falls at the end of a sentence, place the marker outside the
  punctuation ending that sentence, and before the next sentence;
- where it falls at a paragraph break, place it at the end of the preceding
  paragraph rather than at the beginning of the following one.

In a range draft, the header states where the draft begins; mark the folio
breaks that fall within the drafted English.

Do not footnote a marker's placement: the translator verifies and, where
needed, moves markers when reviewing the draft.

Two IV.H requirements Stage 1 does not carry out itself; record them in Open
questions instead:

- if the Stage 0 record lists a duplicate of the work elsewhere in the Kangyur,
  only this Toh number's Degé folios are marked; say that the duplicate's
  folio markers have not been added, and that this copy's own markers would
  then be relabeled `Fx` or `Fy`;
- for a text in the range Toh 508–543, say which printing the folio numbers
  follow if the retrieval establishes it, and that it was not established if
  it does not.

**Notes are real footnotes, not a separate endnote section.** Mark a note with a
reference at the point of difficulty and attach the note as a document footnote:
a genuine Word footnote in the `.docx`, rendered at the bottom of the
page rather than collected in a back-of-document list, and markdown footnote
syntax (`[^n]` inline with a `[^n]: …` definition) in the `.md`, which
converts cleanly when the `.docx` is generated. Do not use a numbered "Draft
notes" list with bracketed cross-references — footnotes replace that apparatus.
The note text opens with the `[?]` / `[??]` severity marker where applicable,
since that marker no longer appears inline. Tibetan quoted in a note is in
Extended Wylie per `shared-policies/transliteration`. Notes recording Stok
Palace variants follow `shared-policies/stok-consultation`; where one falls at
a point that already carries a note, the two are combined.

### 4. Terminology notes

The compact Tibetan/Sanskrit/English reference table specified in
`shared-policies/terminology`, keyed to first occurrence in the translation body.
For a range draft, the table covers the terms that occur within the range.

## Not this

- Do not reproduce the source Tibetan in the translation body, in either
  script, and do not present the English as passages paired with the Tibetan.
- Do not quote Tibetan in Uchen Unicode anywhere in the draft. Wherever it is
  quoted, it is in Extended Wylie.
- Do not number passages or paragraphs, and do not put a folio label on every
  paragraph: a folio marker stands only where a folio break falls.
- Do not print a `folio_uuid` anywhere in the draft. The translator and the
  editor need the folio number and side, and nothing else.
- Do not reorder the source's content or leave any part of the scope
  untranslated.
- Do not footnote the placement of a folio marker.
- Do not adopt a Stok Palace reading in the translation body. A reading that
  seems better is proposed in a note.
- Do not let a range draft's Open questions, Summary or Terminology Notes reach
  beyond the range.
