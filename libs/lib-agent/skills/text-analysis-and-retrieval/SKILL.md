---
name: text-analysis-and-retrieval
description: Run Stage 0 of the 84000 AI translation pipeline for a canonical Tibetan work — retrieve the Tibetan source by Toh number, register the work against the Toh catalog, and assemble the contextual record a translator needs before drafting (genre, register, precedent translations, terminological field, parallel witnesses), saved as toh#_stage0.md. Use when a translator asks to analyze, scope, research, or prepare a text by Toh number before drafting begins, or names Stage 0 of the pipeline. Also use when a witness collation against a parallel recension is requested. Not for producing a translation — that is Stage 1, the first-draft-translation skill — and not for editorial review of an existing draft.
---

# 84000 text analysis and retrieval (Stage 0)

You are performing the preliminary analysis and retrieval pass for a text before
any drafting begins. Given a Tohoku (Toh) number, retrieve the Tibetan source,
establish where the text sits in the canon, and assemble the contextual record a
translator or research editor needs before committing to a drafting approach.

This stage produces no translation and no interpretive judgment about the text's
meaning. It produces a structured record: what the text is, where it comes from,
what already exists about it, and what the translator still needs to decide or
supply. Everything here is verifiable against the source and the catalog —
nothing asserted from memory.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. When the Stage 0 standard is revised,
> the revision reaches you as a plugin update — so check you are on the current
> plugin version if a translator refers to guidance you do not find here.

## Before you start

Confirm each of these at the start of the session:

- [ ] The Toh number of the work — the minimum requirement to begin
- [ ] The `tibetan-source-text` skill and the 84000 Studio catalog/database
      tools
- [ ] Any translator preferences already known — base recension, prior
      familiarity with the text, planned team
- [ ] Nothing further for the guidelines themselves: the sections this skill
      cites from the *Translator Guidelines* and the *Text Critical Guidelines*
      are vendored under `reference/translator-guidelines/` and
      `reference/text-critical-guidelines/`. Consult the full documents for
      anything beyond those sections

If only the Toh number is available, proceed with retrieval and catalog
registration, then use the solicitation step below to gather the rest directly
from the translator rather than guessing.

## Retrieval

- Fetch the Tibetan source — Degé Kangyur/Tengyur, Uchen Unicode — for the given
  Toh number with the `tibetan-source-text` skill.
- Record the Degé volume, section, and folio range as returned by the source
  lookup.
- Note **at retrieval time** whether the text has one Kangyur/Tengyur location
  or duplicates elsewhere in the canon. If duplicates exist, record all
  locations, not just the first found — the Fx/Fy/Fz labeling this feeds is
  specified in
  `reference/translator-guidelines/IV.H-content-layout-and-folio-markers.md`.
- **If retrieval fails or returns an ambiguous match** — a Toh number spanning
  multiple works, a title mismatch — stop and flag it rather than guessing which
  text was intended.

## Catalog registration

- Look up the work in the Toh catalog and record its canonical section (General
  Sūtra Section, Perfection of Wisdom, Discourses, Avataṃsaka, Ratnakūṭa,
  Vinaya, Action Tantra, Unexcelled Yoga Tantra, and so on) **exactly as the
  catalog names it**. Do not infer the section from the title or the content.
- Record adjacent catalog metadata that bears on later stages: any duplicate
  listings elsewhere in the Kangyur/Tengyur, and the work's position relative to
  texts it is grouped or bundled with — a cycle, a shared bam po sequence.
- **If the catalog lookup and the source-text lookup disagree** on volume or
  folio placement, flag the discrepancy explicitly rather than reconciling it
  silently.

## Soliciting translator input

Beyond what can be established mechanically, ask the translator directly for
anything the record needs that only they can supply. At minimum, solicit:

- Which recension or base text they intend to work from, if not the default
  Degé.
- Whether a translation team, style anchors, or a target readership adjustment
  have already been decided.
- Any prior familiarity with precedent translations, secondary scholarship, or
  parallel witnesses they already know about.
- Any deliberate scope decisions — abbreviating a text's own internal
  repetitions, for instance — made before drafting begins.
- **Whether a witness collation should be undertaken for this text.** Frame this
  as a case-by-case decision, not a default: ask whether the translator wants it
  done at Stage 0, deferred to later, or skipped for this text, and record the
  answer either way. See `reference/collation.md` for what the Text Critical
  Guidelines recommend and what the report contains.

Record their answers verbatim or in close paraphrase in the output document. Do
not paraphrase away specifics like edition names or scholars' names.

## House style

The prose this stage writes — the prefatory note, the variant explanations, the
open questions — follows 84000 house style like anything else the studio
publishes:

- **Use typographer's quotation marks and apostrophes throughout** — ‘ ’ “ ” —
  never the straight typewriter forms, per
  `translator-guidelines/IV.A-spelling.md`.
  *The one exception is Extended Wylie*, wherever it appears: the *a-chung* (འ)
  transliterates as a straight apostrophe, which a word processor will silently
  turn into a left single quotation mark when it follows a space. Leave every
  Wylie a-chung as a straight `'`, and confirm it survived generation of any
  `.docx`.

## The disciplines

Each has its own reference file. Read the one you need when you reach it.

| | |
|---|---|
| `reference/analytics.md` | The analytics pass — genre, register, precedent translations, terminological field, parallel witnesses |
| `reference/collation.md` | The collation report, when a witness comparison is undertaken |
| `reference/output.md` | The deliverables and how they are saved |

## Working order

1. Retrieve the Tibetan source and record its placement.
2. Register the work against the Toh catalog.
3. Solicit translator input, including the collation decision.
4. Run the analytics pass per `reference/analytics.md`.
5. Produce the collation report per `reference/collation.md`, if one was
   requested.
6. Assemble and save `toh#_stage0.md` per `reference/output.md`.

## Not this

- **Do not begin drafting** a translation, summary, or introduction at this
  stage — that belongs to later stages.
- **Do not infer the canonical section** from the title or your own reading of
  the text. Take it from the catalog.
- **Do not assert that a precedent translation, parallel witness, or piece of
  scholarship exists** without a citation or source you can point to.
- **Do not silently resolve a discrepancy** between the catalog and the source
  text, such as conflicting folio ranges. Flag it for the translator or editor.
- **Do not overwrite an existing `toh#_stage0.md`** for the same work without
  confirming with the translator that a re-run is intended.
