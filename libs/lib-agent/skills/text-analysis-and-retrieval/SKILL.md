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
- [ ] The `write-session-documents` studio tool, for saving the stage's
      deliverables to storage, and `read-session-documents` for seeing what the
      work already has saved. See `reference/output.md`
- [ ] The `read-policies` studio tool, for the *Translator Guidelines* and
      *Text Critical Guidelines* sections this skill cites and for
      `shared-policies/analytics` and `shared-policies/collation`. Read them at
      the start of the session: they are edited in place, so the current text
      binds, not a remembered one. Call it with no arguments to see what else is
      available, and consult the full documents for anything beyond the sections
      it returns

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
  `translator-guidelines/IV.H-content-layout-and-folio-markers`.
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
  answer either way. See `shared-policies/collation` for what the Text Critical
  Guidelines recommend and what the report contains.

Record their answers verbatim or in close paraphrase in the output document. Do
not paraphrase away specifics like edition names or scholars' names.

## House style

The prose this stage writes — the prefatory note, the variant explanations, the
open questions — follows 84000 house style like anything else the studio
publishes:

- **Use typographer's quotation marks and apostrophes throughout** — ‘ ’ “ ” —
  never the straight typewriter forms, per
  `translator-guidelines/IV.A-spelling`.
  *Extended Wylie needs particular care*, wherever it appears. The *a-chung* (འ)
  transliterates as a **closing** single quotation mark — `’` (U+2019), its
  convexity to the right, a closing inverted comma. It is **not** a straight
  apostrophe `'` (U+0027), and **not** the opening `‘` (U+2018) that a word
  processor produces automatically, which it usually will, since an a-chung
  normally follows a space. Sweep the Wylie for `‘` and correct each one, and
  confirm the `’` survived generation of any `.docx`.

## The disciplines

The first two are policies: fetch them with `read-policies` at the start of the
session, since they are edited in place and the current text binds. The last
ships with this skill.

| | |
|---|---|
| `shared-policies/analytics` | The analytics pass — genre, register, precedent translations, terminological field, parallel witnesses |
| `shared-policies/collation` | The collation report, when a witness comparison is undertaken |
| `reference/output.md` | The deliverables and how they are saved |

## Working order

1. Retrieve the Tibetan source and record its placement.
2. Register the work against the Toh catalog.
3. Solicit translator input, including the collation decision.
4. Run the analytics pass per `shared-policies/analytics`.
5. Produce the collation report per `shared-policies/collation`, if one was
   requested.
6. Assemble and save `toh#_stage0.md` locally per `reference/output.md`.
7. Save the stage's deliverables to storage with `write-session-documents`,
   passing the work's `toh`, `stage: stage0`, the files with `toh#_stage0.md` as
   `primary` and any collation pair as `supporting`, and your `model` — then PUT
   each file to the upload URL it returns. See `reference/output.md`; the save
   is not complete until every upload has succeeded.

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
  confirming with the translator that a re-run is intended. Check with
  `read-session-documents` rather than by looking for a local file. Storage
  archives what a re-run replaces, so the previous record is recoverable — but
  the translator should still know a re-run is happening.
- **Do not report the stage as saved** when an upload failed or the client could
  not make the PUT. A manifest exists either way; the file does not.
