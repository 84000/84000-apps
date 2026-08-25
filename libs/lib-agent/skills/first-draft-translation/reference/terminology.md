# Terminology

**No formal glossary entry is drafted at this stage.** The
Tibetan/Sanskrit/English/definition/alternatives table of Guidelines V.H
(not vendored — it governs a later stage, not this one) comes
after editorial review, once terminology choices are confirmed. This file
governs how terminology decisions are *made and recorded during drafting*, not
how they are packaged for submission.

## Locating the binding rendering

Before rendering a significant or technical term, check for an existing 84000
house rendering. There is no library-wide glossary search, so the escalation is
work → canonical section:

1. **This work's own glossary** — `get-glossary-instances` for the work, and
   `search-glossary-terms` / `get-glossary-term` / `list-glossary-terms`.
2. **This text's canonical section**, via the `glossary-by-canon-section`
   skill, for terms not found in the work itself.

**A located entry is binding — use it even if you would prefer another
rendering.** What binds is the published house rendering; section glossary
lookups read the published snapshot by default for exactly that reason.

If no entry can be located by either route, propose a rendering and mark it
`[new term]` on first occurrence in the translation body, and record it in the
Terminology Notes.

## Terminology Notes format

A compact reference table, not a decision log. Three columns:

**Tibetan (Wylie) / Sanskrit (IAST) / English**

For the English column:

- Default to the **most common English rendering** — the located house entry
  where one exists, or, for a `[new term]`, the rendering most likely to match
  how the term is glossed elsewhere in the canon.
- Where a different rendering is not the most common but is **attested in a
  comparable or adjacent glossary** (a canon-section neighbour), add it as a
  separately marked **alternative** rather than omitting it. The editor may
  prefer it, and it should not be lost.
- **No status, basis, or reasoning column**, and do not restate the reasoning
  behind a choice here. If a rendering needs justification — why it was chosen
  over a rival reading, why it collides with a neighbouring work's glossary, why
  it varies by context — that reasoning belongs in the footnote attached to the
  term's first occurrence in the translation body. The table is for quick
  scanning; the notes carry the argument.

The table is keyed to first occurrence in the translation body.

## Consistency and transliteration

- Maintain strict one-to-one consistency within the text: one source term, one
  English rendering — unless context genuinely forces variation, in which case
  note it in the passage footnote, not the terminology table.
- Sanskrit follows IAST transliteration.
- Leave conventionally untranslated terms (proper names, mantra, dhāraṇī) in
  accordance with `translator-guidelines/II.C-terminology.md`; transliterate
  mantras without translation except as
  `translator-guidelines/IV.G-mantras-and-dharanis.md` specifies.

## Not this

- Do not draft formal glossary entries at this stage.
- Do not cite an existing glossary entry that was not actually located through
  the studio glossary tools or the `glossary-by-canon-section` skill.
- Do not pad the table with reasoning, status labels, or a decision-log
  narrative.
