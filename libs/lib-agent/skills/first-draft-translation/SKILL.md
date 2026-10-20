---
name: first-draft-translation
description: Produce a Stage 1 first-draft 84000 translation of a canonical Tibetan work — the whole text or a specified Degé folio range — for review by a research editor, as English with Degé folio markers, footnoted uncertainties and a terminology table, saved as toh#_stage1.docx and toh#_stage1.md (with the folio range in the filename for a range draft). Use only when a translator specifically asks for a first draft, or Stage 1, of a whole text or a folio range, by Toh number. A line or short passage is not a Stage 1 task — translate it ad hoc, without this skill. Not for editorial review of an existing draft — that is Stage 2, the editorial-review skill — and not for Stage 0 text analysis and retrieval, which must already have been run.
allowed-tools: Skill(docx)
---

# 84000 first-draft translation (Stage 1)

You are producing a first draft of an 84000 translation — of a whole text, or
of a folio range of one — for review by a research editor. The draft should be
complete and publishable in form, but it is not final. Give the editor a text
that is accurate, consistent, and transparent about its own uncertainties — not
one that conceals difficulties beneath fluent English.

A good first draft maximizes the editor's efficiency: everything that can be
settled mechanically is settled; everything requiring scholarly judgment is
clearly flagged and left for the editor. The draft is in English only: the
source Tibetan is not reproduced in it. Degé folio markers, placed in the
English where each folio break falls, let the translator and the editor check
any stretch of the draft against the source.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. When the drafting standard is revised,
> the revision reaches you as a plugin update — so check you are on the current
> plugin version if a translator refers to guidance you do not find here.

## Scope

Stage 1 drafts one of two things:

- **the whole text**, or
- **a folio range** of it, given as Degé folio sides — `F.12.a–F.20.b`.

Run it only when a translator specifically asks for a first draft, or for
Stage 1, of one or the other. **A request to translate a line or a short
passage is not a Stage 1 task**: handle it ad hoc, without these instructions,
and do not produce the Stage 1 deliverables for it. If a request for a first
draft does not say which scope is meant, ask.

**Range boundaries.** A range draft begins with the first sentence or stanza
that begins within the range, and ends with the sentence or stanza in progress
at the end of the range — completed, even where it runs onto the next folio
side. State in the header exactly where the draft begins and ends, so that
consecutive range drafts can be seen to meet.

**Earlier drafts.** Check what Stage 1 drafts are already saved for the work
before drafting (see `reference/output.md`). If one already covers any part of
the requested scope, tell the translator and confirm before drafting: a draft
saved under an existing filename archives the earlier one.

## Before drafting

Stage 1 assumes **Stage 0 (Text Analysis and Retrieval) has already been run**
for this work. Look for its record in storage, not on local disk: Stage 0 may
have been run in another session, on another machine, by someone else. If no
`toh#_stage0.md` has been saved for this work, stop and run Stage 0 first rather
than reconstructing its retrieval, catalog, and analytics record here. Stage 0
is governed by the `text-analysis-and-retrieval` skill in this plugin.

A read that _fails_ is not a record that is _absent_, and the two must not be
treated alike — see _Reading the Stage 0 record_ in `reference/output.md`.

Confirm each of these at the start of the session, retrieving from the studio
where noted rather than asking the translator to supply it:

- [ ] The scope of the draft — the whole text, or a stated folio range. See
      _Scope_ above
- [ ] A completed Stage 0 record (`toh#_stage0.md`) for this text, read out of
      storage with `read-session-documents` rather than assumed to be a local
      file left by an earlier session. See `reference/output.md`
- [ ] Any Stage 1 drafts already saved for the work, read out of storage the
      same way, for terminological consistency. See `reference/output.md`
- [ ] The Tibetan source, retrieved from the studio via the `tibetan-source-text`
      skill / `get-translation-folios` — never uploaded or pasted — with folio
      references, so that each folio break can be placed in the English
- [ ] Any parallel witnesses (Sanskrit, Chinese, other Kangyur recensions)
- [ ] The translator's answer on consulting the **Stok Palace Kangyur**,
      asked after the scope is established; and, if they say yes, the Stok
      Palace line in the Stage 0 record's Recensions subsection and the
      `kangyur-tengyur-recensions` skill, for retrieving its eText. See
      `shared-policies/stok-consultation`
- [ ] The **exegetical-sources section of the Stage 0 record** — which
      commentaries were found for this work, which of them the translator
      selected for consultation here, and whether Stage 0 demonstrated that
      their passages can be anchored to a root-text folio range. If that
      section records the selection as solicited but unanswered, ask before
      drafting rather than choosing for the translator; if the record has no
      such section, it predates the step, so say so and ask. See
      `shared-policies/commentary-consultation`
- [ ] The studio glossary tools (`get-glossary-instances`,
      `search-glossary-terms`, `get-glossary-term`, `list-glossary-terms`) and
      the `glossary-by-canon-section` skill, for checking existing terminology
      rather than relying on a table supplied in-session
- [ ] The `read-policies` studio tool, for the Translator Guidelines sections
      this skill cites — `translator-guidelines/IV.H-content-layout-and-folio-markers`
      among them — and for `shared-policies/uncertainty`,
      `shared-policies/terminology`, `shared-policies/commentary-consultation`,
      `shared-policies/transliteration` and `shared-policies/stok-consultation`.
      Read them at the start of the
      session: they are edited in place, so the current text binds, not a
      remembered one. Call it with no arguments to see what else is available,
      and consult the full document for anything beyond the sections it returns
- [ ] Any related published 84000 translations designated as style anchors
- [ ] The `docx` skill, for generating the primary `toh#_stage1.docx`
      deliverable. This is Claude's general document skill, not one this plugin
      ships
- [ ] The `write-session-documents` studio tool, for saving the two
      deliverables to storage. See `reference/output.md`

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
- A canonical commentary the translator selected at Stage 0 is an aid to
  construal, **not a second source authority**. Translate the root text as
  transmitted; where a commentary construes it otherwise, or quotes a lemma that
  differs from the transmitted reading, record that in a note rather than
  adopting it silently. See `shared-policies/commentary-consultation`.
- The Stok Palace Kangyur, where the translator asked for it to be consulted,
  is a witness, **not a second source authority**. Translate the Degé; record
  each substantive Stok variant in a footnote, and propose a Stok reading that
  seems better in a note rather than adopting it. See
  `shared-policies/stok-consultation`.
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
  `translator-guidelines/IV.A-spelling`. This holds for the English, the
  footnotes, and the Terminology Notes alike.
  _Extended Wylie needs particular care._ It is the only form of Tibetan in the
  draft, wherever Tibetan is quoted outside the translation body, and follows
  `shared-policies/transliteration`. The _a-chung_ (འ)
  transliterates as a **closing** single quotation mark — `’` (U+2019), its
  convexity to the right, a closing inverted comma. It is **not** a straight
  apostrophe `'` (U+0027), and **not** the opening `‘` (U+2018) that a word
  processor produces automatically, which it usually will, since an a-chung
  normally follows a space. Sweep the Wylie for `‘` and correct each one, and
  confirm the `’` survived generation of the `.docx`.

## The disciplines

The first five are policies: fetch them with `read-policies` at the start of
the session, since they are edited in place and the current text binds. The
other two ship with this skill — read those when you reach them.

|                                           |                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `shared-policies/uncertainty`             | How to flag what is not secure — the single most important discipline here                         |
| `shared-policies/terminology`             | Locating the binding house rendering before choosing one, and the Terminology Notes table          |
| `shared-policies/commentary-consultation` | Consulting and citing a commentary the translator selected at Stage 0                              |
| `shared-policies/transliteration`         | Extended Wylie, the only form of Tibetan in the draft                                              |
| `shared-policies/stok-consultation`       | Asking whether to consult the Stok Palace Kangyur, and noting its substantive variants             |
| `reference/structure.md`                  | The document structure, layout, folio markers, and footnotes                                       |
| `reference/output.md`                     | The two deliverables, their filenames, and how they are read and saved                             |

## Working order

1. Read the Stage 0 record for this work out of storage with
   `read-session-documents`, and list what else the work has saved, any
   earlier Stage 1 drafts included. See `reference/output.md`.
2. Establish the **scope** — the whole text or a folio range — and check it
   against the Stage 1 drafts already saved. See _Scope_ above.
3. Ask the translator whether the **Stok Palace version** should be consulted,
   giving them what `shared-policies/stok-consultation` lists. If they say
   yes, retrieve its eText for the scope and compare it with the Degé, per the
   same policy.
4. Establish the **title**: from the Tibetan source itself — not the studio
   catalog's `mainTitle` — for a whole-text draft or a range draft that begins
   at the start of the text; otherwise from the Stage 0 record. See
   `reference/structure.md`.
5. Read the renderings and Terminology Notes of any earlier Stage 1 drafts of
   the work, so this draft stays consistent with them. See
   `reference/output.md`.
6. Draft the scope in order, laying out paragraphs and verse per
   `translator-guidelines/IV.H-content-layout-and-folio-markers` and placing a
   Degé folio marker in the English at each folio break, per the same section.
   Check terminology per `shared-policies/terminology` before rendering a
   significant term. Where a passage is genuinely difficult and the translator
   selected a commentary at Stage 0, consult it per
   `shared-policies/commentary-consultation` and cite it in a footnote at the
   point of difficulty. If the Stok Palace version is being consulted,
   footnote each substantive variant at the point in the English where it
   falls, per `shared-policies/stok-consultation`.
7. Assemble the document in the order given in `reference/structure.md`.
8. Write both deliverables locally, and run the check in _Before saving_ in
   `reference/output.md`.
9. Save them to storage with `write-session-documents`, passing the work's
   `toh`, `stage: stage1`, the files with the `.docx` as `primary` and the
   markdown record as `supporting`, and your `model` — then PUT each file to
   the upload URL it returns. See `reference/output.md`; the save is not
   complete until every upload has succeeded, the `.docx` included.

Do not draft the introduction unless explicitly asked; introductions require
research the editor will direct.
