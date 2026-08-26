---
name: first-draft-translation
description: Produce a Stage 1 first-draft 84000 translation of a canonical Tibetan work for review by a research editor — aligned Tibetan/English passage pairs with folio references, footnoted uncertainties, a terminology table, and a companion alignment record, saved as toh#_stage1.docx, toh#_stage1.md, and toh#_stage1_alignment.md. Use when a translator asks to draft, translate, or produce a first draft of a text by Toh number, or names Stage 1 of the 84000 AI translation pipeline. Not for editorial review of an existing draft, and not for Stage 0 text analysis and retrieval, which must already have been run.
---

# 84000 first-draft translation (Stage 1)

You are producing a first draft of an 84000 translation for review by a research
editor. The draft should be complete and publishable in form, but it is not
final. Give the editor a text that is accurate, consistent, and transparent
about its own uncertainties — not one that conceals difficulties beneath fluent
English.

A good first draft maximizes the editor's efficiency: everything that can be
settled mechanically is settled; everything requiring scholarly judgment is
clearly flagged and left for the editor. Every English passage is paired with
its Tibetan source passage, so the editor can check the rendering against the
source without cross-referencing a second document. That pairing is established
with the `tibetan-english-passage-alignment` skill rather than by eye, so each
pairing carries a verifiable folio reference and an explicit confidence rating
instead of an unstated assumption of correctness.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. When the drafting standard is revised,
> the revision reaches you as a plugin update — so check you are on the current
> plugin version if a translator refers to guidance you do not find here.

## Before drafting

Stage 1 assumes **Stage 0 (Text Analysis and Retrieval) has already been run**
for this work. If no `toh#_stage0.md` exists yet, stop and run Stage 0 first
rather than reconstructing its retrieval, catalog, and analytics record here.
Stage 0 is governed by the `text-analysis-and-retrieval` skill in this plugin.

Confirm each of these at the start of the session, retrieving from the studio
where noted rather than asking the translator to supply it:

- [ ] A completed Stage 0 record (`toh#_stage0.md`) for this text
- [ ] The Tibetan source, retrieved from the studio via the `tibetan-source-text`
      skill / `get-translation-folios` — never uploaded or pasted — with folio
      references, and segmented into passages if Stage 0 established a
      segmentation
- [ ] The `tibetan-english-passage-alignment` skill, for establishing and
      recording passage alignment
- [ ] Any parallel witnesses (Sanskrit, Chinese, other Kangyur recensions)
- [ ] The studio glossary tools (`get-glossary-instances`,
      `search-glossary-terms`, `get-glossary-term`, `list-glossary-terms`) and
      the `glossary-by-canon-section` skill, for checking existing terminology
      rather than relying on a table supplied in-session
- [ ] Nothing further for the Translator Guidelines: the sections this skill
      cites from v. 10.31 are vendored under `reference/translator-guidelines/`.
      Consult the full document for anything beyond those sections
- [ ] Any related published 84000 translations designated as style anchors
- [ ] The `docx` skill, for generating the primary `toh#_stage1.docx`
      deliverable. This is Claude's general document skill, not one this plugin
      ships
- [ ] The translator's choice of Tibetan display format for this draft —
      Unicode or Extended Wylie, not both

If any are missing, say so before drafting rather than proceeding on
assumptions.

## Source authority

The Tibetan source is retrieved directly from the studio — never a file
uploaded, pasted, or otherwise supplied by the translator. That retrieved Degé
text is the sole authority. Translate what it says, not what a parallel, a
dictionary, or a more common reading suggests it "should" say. **If retrieval
fails, stop and say so** rather than asking the translator for an etext or
falling back to one supplied ad hoc.

- Never emend silently. If the source appears corrupt, translate the reading as
  transmitted and add a note proposing the emendation, with your reasoning and
  any supporting witnesses.
- Where a Sanskrit parallel or Chinese witness is provided, use it to inform
  interpretation, but do not import its readings into the translation. Note
  divergences of substance between witnesses.
- Do not fill lacunae, reconstruct damaged passages, or supply text the source
  does not contain. Mark gaps explicitly.
- Do not consult or reproduce existing published translations of the text unless
  they are provided in the session; if one is provided, treat it as a reference
  witness, not a base text.
- Do not normalize Tibetan orthography, "correct" spellings toward standard
  forms, or harmonize the source toward parallels.
- Do not omit, soften, or gloss over content you consider difficult, repetitive,
  or sensitive. The canon is translated as it stands.

Toh numbers a translator cites are not always catalogue entries — some are
superseded, some are covered by another entry's range. Run `resolve-toh` before
concluding that a cited number does not exist.

## Register and style

- Follow the 84000 house style: clear, contemporary English that is accurate
  first and elegant second. Avoid both archaizing ("thee", "verily") and casual
  register.
- Render verse as verse, preserving the source's stanza divisions. Do not force
  meter or rhyme at the expense of accuracy. **Capitalize the first word of
  every line of verse**, following Western convention, including where the line
  continues a sentence begun on the line above.
- Preserve the rhetorical structure of the source — repetitions, formulaic
  passages, and epithets are features of the genre, not redundancies to trim.
  Abbreviate repeated formulae only where the source itself abbreviates.
- Reflect the source's honorific grammar in natural English without artificial
  inflation.
- Do not present uncertain renderings with confident prose. Calibrate the
  English to the actual security of the reading.
- **Use typographer's quotation marks and apostrophes throughout** — ‘ ’ “ ” —
  never the straight typewriter forms, per
  `translator-guidelines/IV.A-spelling.md`. This holds for the English, the
  footnotes, and the Terminology Notes alike.
  *Extended Wylie needs particular care*, wherever it appears. The *a-chung* (འ)
  transliterates as a **closing** single quotation mark — `’` (U+2019), its
  convexity to the right, a closing inverted comma. It is **not** a straight
  apostrophe `'` (U+0027), and **not** the opening `‘` (U+2018) that a word
  processor produces automatically, which it usually will, since an a-chung
  normally follows a space. Sweep the Wylie for `‘` and correct each one, and
  confirm the `’` survived generation of the `.docx`.

## The four disciplines

Each has its own reference file. Read the one you need when you reach it.

| | |
|---|---|
| `reference/uncertainty.md` | How to flag what is not secure — the single most important discipline here |
| `reference/terminology.md` | Locating the binding house rendering before choosing one, and the Terminology Notes table |
| `reference/structure.md` | The document structure, passage pairs, folio labels, footnotes, and the companion alignment record |
| `reference/output.md` | The three deliverables and how they are saved |

## Working order

1. Ask the translator whether the source Tibetan should be shown as **Unicode
   (Uchen)** or **Extended Wylie** for this draft. Pick one; never both for the
   same passage. Default to Unicode if they decline to state a preference, and
   say in the header that this was the default rather than a stated preference.
   See `reference/structure.md`.
2. Establish the **title** from the Tibetan source itself, not the studio
   catalog's `mainTitle`. See `reference/structure.md`.
3. Draft passage by passage, aligning each pair with
   `tibetan-english-passage-alignment` and checking terminology per
   `reference/terminology.md` before rendering a significant term.
4. Assemble the document in the order given in `reference/structure.md`.
5. Save all three deliverables per `reference/output.md`.

Do not draft the introduction unless explicitly asked; introductions require
research the editor will direct.
