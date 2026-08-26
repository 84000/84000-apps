# Document structure and apparatus

## Two decisions to make first

### Tibetan display format

Ask the translator whether the source Tibetan should be shown as **Unicode
(Uchen script)** or **Extended Wylie** transliteration for this draft. Pick one;
**never both for the same passage.** Apply the choice consistently across the
entire document — the translation body and any Tibetan quoted inside a note —
and record it in the header block (e.g. "Source Tibetan is shown in Extended
Wylie for this draft") so anyone opening the file later knows which is in use
without inferring it.

If the translator has no preference when asked, default to **Unicode** — the
form the retrieval tools return natively — and say in the header that this was
the default rather than a stated preference. Do not pick silently.

If the translator changes preference partway through a session, convert what is
already drafted rather than leaving a mixed document.

### The title

Establish the title **from the Tibetan source text itself** before assembling
anything: its own opening title statement (typically "In the language of India:
… In the language of Tibet: …", given in the `[ti]` passage) or, for a text that
opens without one, its closing colophon title.

Translate that source-given title (Sanskrit and Tibetan, where both are given)
into English following `translator-guidelines/IV.D-text-titles.md`, and use that English
rendering — **not the studio catalog's `mainTitle`** — as the title of both
`toh#_stage1.md` and `toh#_stage1.docx`.

If the source-derived title differs materially from the catalog's `mainTitle` or
from the title recorded in Stage 0, do not silently prefer one: use the
source-derived title as instructed here, and flag the discrepancy both as a note
and as an open question for the editor.

## The structure, in this order

### 1. Open questions for the editor

Placed **first**, immediately after the header block and before the Summary, so
the editor sees the global issues requiring a decision before reading the
translation. A short list of the global or structural decisions the editor must
make — the rendering of a pervasive term, the treatment of a structural anomaly,
a title discrepancy — plus a pointer to any `[??]` items needing adjudication.

This is the one section about the draft as a whole. Everything passage-specific
belongs in that passage's footnote instead.

### 2. Summary

One short paragraph, following house conventions.

### 3. Translation body

Presented as **aligned Tibetan/English passage pairs**: each passage of source
Tibetan followed immediately by its English rendering, in that order, before the
next Tibetan passage begins.

**Tibetan display.** The single format chosen for this session, everywhere
Tibetan appears.

**Passage numbering is a navigational aid only.** The sequential label ("12.")
is a visual anchor for cross-referencing within this working draft — locating a
passage, citing it in a note, tying it to its row in the companion alignment
record. Keep it lightweight; a simple running number is enough. Do not build
additional apparatus around it, and do not confuse it with the section-numbering
conventions for the published text in
`translator-guidelines/IV.H-content-layout-and-folio-markers.md`, which are
applied separately.

**Granularity** follows the segmentation already established for the text — from
the Stage 0 retrieval/segmentation pass — typically a sentence, clause group, or
verse, rather than being re-segmented arbitrarily during drafting.

**A folio label on every passage**, in the form `[F.123.a]` — e.g. `[F.157b]` —
at the start of its Tibetan line, not only at a folio break. The translator
should see which folio a passage is on at a glance, without scanning backward
for the last milestone. Where a passage spans more than one folio, give one
bracket per folio touched, in reading order, each placed where that folio
actually begins within the passage.

**Do not print the `folio_uuid` in the translation body.** It matters
downstream, but the translator and the editor need the folio number and side and
nothing else, and a UUID on every passage makes the page unreadably busy. The
UUIDs are carried instead by the companion alignment record, which is where
downstream consumers read them from. This applies to `toh#_stage1.md` exactly as
it applies to `toh#_stage1.docx` — the two bodies do not diverge.

**Notes are real footnotes, not a separate endnote section.** Mark a note with a
reference at the point of difficulty and attach the note as a document footnote:
a genuine Word footnote in `toh#_stage1.docx`, rendered at the bottom of the
page rather than collected in a back-of-document list, and markdown footnote
syntax (`[^n]` inline with a `[^n]: …` definition) in `toh#_stage1.md`, which
converts cleanly when the `.docx` is generated. Do not use a numbered "Draft
notes" list with bracketed cross-references — footnotes replace that apparatus.
The note text opens with the `[?]` / `[??]` severity marker where applicable,
since that marker no longer appears inline.

**Establish each pairing with the skill, not by eye.** For each passage pair,
give `tibetan-english-passage-alignment` the English passage and the
folio-tagged Tibetan, and use its output — the exact Tibetan chunk, the folio(s)
touched, and a confidence rating — to:

1. place the correct `[F.123.a]` milestone(s) inline,
2. record the full alignment — `folio_uuid` included — in the companion
   alignment record, and
3. attach a footnote if confidence is moderate or low.

### 4. Terminology notes

The compact Tibetan/Sanskrit/English reference table specified in
`terminology.md`, keyed to first occurrence in the translation body.

## The companion alignment record

The alignment record is **not a section of the stage 1 translation.** It is a
separate report, `toh#_stage1_alignment.md`, saved alongside the two translation
deliverables — see `output.md`. It is machine-checkable traceability rather than
prose an editor revises, so it stays out of the document the editor is reading
and marking up.

One entry per passage pair, as returned by `tibetan-english-passage-alignment`,
keyed to the same passage number used in the translation body so an entry can be
traced back to its pair. Give each folio touched **its own row with three
separate columns — Folio Number, Folio Side, and Folio UUID** — rather than a
single merged "F.123.a" column, plus the confidence rating for that entry.

This is the machine-checkable record behind the inline pairing in the body, and
now the only place the `folio_uuid` appears. Each UUID is the exact value
returned for that folio by `tibetan-english-passage-alignment` /
`get-translation-folios` — never a value you construct, approximate, or omit.
Keep the record complete even where confidence is high, so every passage is
traceable back to its exact source folio(s), and so the record can be scanned or
filtered by folio number, side, or UUID independently.

## Not this

- Do not present an English passage without its aligned Tibetan passage, and do
  not silently re-segment or reorder passages such that the alignment between
  the two becomes unclear.
- Do not align passages by eye when `tibetan-english-passage-alignment` is
  available, and do not fabricate a `folio_uuid` or drop the confidence rating.
  If the skill cannot locate a passage, say so in the alignment record and in
  Open questions rather than guessing.
- Do not print a `folio_uuid` in the translation body, and do not fold the
  alignment record back into the stage 1 translation as a fifth section.
- Do not display the source Tibetan in both Unicode and Extended Wylie for the
  same passage.
