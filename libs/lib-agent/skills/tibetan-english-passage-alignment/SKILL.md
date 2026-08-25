---
name: tibetan-english-passage-alignment
description: Given a chunk of English translation and the corresponding Tibetan source, find the boundary of the Tibetan span that renders it and report which folio(s) it falls on, with a confidence rating. Use whenever a translator or editor has one specific English passage and needs to know exactly which piece of Tibetan it corresponds to — "find the Tibetan for this paragraph of my draft", "where in Toh 312 does this sentence come from", "align this English passage to the source folios". This is an on-demand lookup for a single given passage. Do not use it to fetch Tibetan when there is no English to align against — that is tibetan-source-text.
---

# Tibetan–English passage alignment

Align one English passage to its span of Tibetan source text and report which
folio(s) it falls on. A single-passage lookup, not a bulk segmentation pass.

## Inputs

- **The English passage** — a sentence, a few sentences, a verse, or a
  paragraph; whatever chunk the person hands you.
- **The Tibetan source, folio-tagged** — folio records carrying `uuid`, `folio`,
  `side` and `content`, as returned by `get-translation-folios` and used by the
  `tibetan-source-text` skill.
- **A Toh number or work UUID**, if the Tibetan was not supplied folio-tagged,
  so you can retrieve it yourself.

If the person pastes a raw block of Tibetan with no folio tags, do not guess
which folios it came from. Resolve the Toh number and re-fetch the folio-tagged
version first — aligning against untagged text produces an answer that cannot be
cited.

## Step 1 — Get folio-tagged Tibetan, if you don't have it

Resolve the number with `resolve-toh` first if there is any chance it is
superseded or covered by another entry, then call `get-translation-folios`:

- **A location hint exists** — a rough folio number, a milestone from a stage-1
  draft, a hint from the person, or a prior alignment for a neighbouring
  passage. Address it directly with `folioNumber` + `side`, or centre on a known
  `folioUuid`, and widen with `before`/`after` only if the passage is not in the
  window. `hasMoreBefore`/`hasMoreAfter` tell you whether widening is even
  possible.
- **No hint at all** — page with `page`/`size` from the beginning, or from
  wherever context suggests ("a passage near the end of chapter 3"). Don't fetch
  an entire long work at once when a narrower window is plausible; don't
  under-fetch either.

Keep `uuid`/`folio`/`side` attached to each folio's content as you work — the
output needs them.

## Step 2 — Find the anchor

Narrow to the right folio(s) before pinning down boundaries.

- Use distinctive content in the English as anchors: proper names, numbers,
  mantra or dhāraṇī syllables, terms with a fixed glossary rendering. Where it
  helps, confirm what Tibetan an English term corresponds to for this work with
  `search-glossary-terms` or `get-glossary-instances`.
- Scan the folio content for the Tibetan matching those anchors, reading for
  meaning rather than pattern-matching English word order onto Tibetan — the two
  do not run in the same sequence within a clause.
- If nothing in the fetched window matches, say so and either widen the window
  or ask whether the Toh number or recension is right. Do not force a match onto
  unrelated content.

## Step 3 — Determine the exact boundary

- Identify where the corresponding Tibetan span actually begins and ends,
  respecting Tibetan sentence and clause boundaries (śad ཤད་ / double śad), not
  the English passage's own sentence breaks. The two languages do not segment
  1:1, and a boundary that looks clean in English can fall mid-clause in
  Tibetan.
- If the span crosses a folio break, note every folio it touches, in order, and
  slice the Tibetan into the portion from each.
- Note the character offset into that folio's `content` where the span starts
  and ends on its first and last folio. This is not part of the reported output,
  but keep it — it is what makes the alignment reproducible, and it matches the
  anchor format the rest of this pipeline uses.

## Step 4 — Rate confidence

An alignment boundary is an interpretive judgment, not a mechanical fact. State
which of these it is:

- **High** — clear lexical or structural anchors on both sides of the boundary
  (a quotation frame, a proper name, a verse break).
- **Moderate** — the general area is certain but the exact word where the
  boundary falls is a judgment call. Common with connectives and honorific frame
  phrases that do not map 1:1.
- **Low / query** — the English is a loose paraphrase, condenses a repeated
  formula, or the source appears to diverge from the English enough that you are
  not confident which Tibetan clause it renders. Say this plainly rather than
  presenting a boundary as settled.

If the English does not appear to be in the Tibetan you have at all — wrong Toh,
wrong recension, or a section you have not fetched — report that directly
instead of forcing an answer.

## Step 5 — Report

For the aligned span:

- One entry per folio touched, each with `folio_uuid`, `folio_number`, `side`,
  and the Tibetan chunk from that folio — only the portion within the aligned
  span, not the whole folio.
- The English passage exactly as given.
- If more than one folio was touched, the full Tibetan chunk combined across
  folios in reading order.
- The confidence level, and a one-line note whenever it is anything but high.

Single folio:

```
English: "Ānanda, go to the city of Vaiśālī…"

Folio: uuid 799bcb19-218e-430d-8202-4c5164663dd4 · F.157b
Tibetan: "ཀུན་དགའ་བོ་ཡངས་པའི་གྲོང་ཁྱེར་ག་ལ་བ་དེར་འདོང་ངོ་། །"
Confidence: high
```

Spanning a folio break:

```
English: "…and the eight great bodhisattvas paid homage to all the buddhas."

Folio: uuid 799bcb19-… · F.157b
Tibetan (from F.157b): "…ཚིགས་སུ་བཅད་པ་"
Folio: uuid a42720dc-… · F.158a
Tibetan (from F.158a): "འདི་དག་སྨྲོས་ཤིག …"
Combined Tibetan: "…ཚིགས་སུ་བཅད་པ་འདི་དག་སྨྲོས་ཤིག …"
Confidence: moderate — boundary falls mid-formula; the exact split point is a judgment call.
```

## What not to do

- Do not paraphrase, retranslate, or "correct" either chunk. Return the Tibetan
  exactly as retrieved (Uchen Unicode, unmodified) and the English exactly as
  given.
- Do not guess a folio, or fabricate a `folio_uuid`, when the passage cannot
  actually be located. Say so instead.
- Do not treat English sentence boundaries as automatically equal to Tibetan
  clause boundaries.
- Do not import readings from a parallel or a published translation to "help"
  the alignment. Align against the Tibetan fetched for this work, per the
  source-authority rule that governs all 84000 session types.
- Do not write the result into the database. This skill finds and reports an
  alignment; it does not persist one. If the person explicitly asks you to save
  it, confirm the target table and required columns with them first.
