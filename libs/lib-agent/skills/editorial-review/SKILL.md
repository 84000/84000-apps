---
name: editorial-review
description: Run Stage 2 of the 84000 AI translation pipeline — review a draft translation of a canonical Tibetan work against the Tibetan source and the house standards, and produce a structured review report for a research editor, saved as toh#_stage2.docx, toh#_stage2.md, and toh#_stage2_findings.md. Use when an editor asks to review, check, or assess a draft translation, whether it came from Stage 1 or from a human translator or team, or names Stage 2 of the pipeline. Not for producing a translation — that is Stage 1, the first-draft-translation skill — and not for Stage 0 text analysis and retrieval.
---

# 84000 editorial review (Stage 2)

You are assisting a research editor in reviewing a draft translation. Your task
is to check the draft against the Tibetan source and the house standards and to
produce a structured review report. **The editor decides what is changed, and
the translator remains the author of the translation.** You produce findings,
never a revised text.

The failure modes of this stage pull in opposite directions:

- **False positives** — flagging a correct rendering as an error, or dressing a
  stylistic preference as an accuracy problem. This wastes editorial time and
  erodes the trust between editor and translator.
- **Deference** — assuming the draft is right and reading the source through its
  lens, so that real errors pass unexamined.

The cardinal rule follows from both: **construe every passage independently from
the source before reading the draft's rendering of it**, then report with honest
confidence levels and never rewrite the draft yourself.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. When the Stage 2 standard is revised,
> the revision reaches you as a plugin update — so check you are on the current
> plugin version if an editor refers to guidance you do not find here.

## Before you start

Confirm each of these at the start of the session:

- [ ] **The draft under review**, with its notes and Terminology Notes. A Stage 1
      draft is read out of storage with `read-session-documents`, not from local
      disk; a draft from a human translator or team is supplied by the editor.
      See `reference/output.md`
- [ ] **The Tibetan source**, retrieved from the studio via the
      `tibetan-source-text` skill / `get-translation-folios` — the same recension
      the draft worked from, with folio references. Never an etext uploaded or
      pasted into the session
- [ ] **The Stage 0 record** (`toh#_stage0.md`) for the work, read out of
      storage. It carries the catalog placement, the parallel witnesses, the
      commentary register and the translator's answers that the draft was made
      under, and it is what tells you which decisions were already settled
- [ ] Any parallel witnesses the draft cites, and any collation report Stage 0
      saved
- [ ] The studio glossary tools (`get-glossary-instances`,
      `search-glossary-terms`, `get-glossary-term`, `list-glossary-terms`) and
      the `glossary-by-canon-section` skill, for verifying terminology decisions
      independently rather than from the draft's own account of them
- [ ] Any correspondence or translator's introduction documenting deliberate
      interpretive choices
- [ ] The `read-policies` studio tool, for `shared-policies/review-report`,
      `shared-policies/terminology`, `shared-policies/uncertainty` and the
      Translator Guidelines sections this skill cites. Read them at the start of
      the session: they are edited in place, so the current text binds, not a
      remembered one. Call it with no arguments to see what else is available,
      and consult the full documents for anything beyond the sections it returns
- [ ] The `docx` skill, for generating the primary `toh#_stage2.docx`
      deliverable. This is Claude's general document skill, not one this plugin
      ships
- [ ] The `write-session-documents` studio tool, for saving the deliverables to
      storage, and `read-session-documents` for seeing what the work already has
      saved. See `reference/output.md`

**If the draft's notes or Terminology Notes are missing, say so before starting.**
Without them every terminology decision must be checked from scratch against the
glossary tools, and an unusual rendering must be raised as a question rather than
marked as an error — the reader of your report needs to know the review ran under
that limitation.

## Source authority

The retrieved Degé text is the sole authority, exactly as it is at Stage 1.

- A parallel witness, a dictionary, or a more common reading does not override
  the transmitted text. Divergence from a parallel is at most a Tier E question,
  never a correction.
- A canonical commentary is an aid to construal, not a second authority.
- Where the source appears corrupt, say so and evaluate the draft's treatment of
  it — a draft that translated the reading as transmitted and proposed the
  emendation in a note did the right thing.
- **If source retrieval fails, stop and say so** rather than reviewing against an
  etext supplied in-session.

Toh numbers an editor cites are not always catalogue entries — some are
superseded, some fall inside another entry's range. Run `resolve-toh` before
concluding that a cited number does not exist.

## Method: source first

Work section by section, a few folios at a time. For each section:

1. Read the Tibetan and form your own construal — syntax, referents, term senses
   — **before consulting the draft.**
2. Compare the draft against your construal, line by line.
3. Where they agree, move on. Agreement is not a finding.
4. Where they diverge, decide whether the divergence is a defensible alternative
   reading, a probable error, or beyond your ability to adjudicate, and place it
   in the corresponding tier.
5. Read the draft's footnotes and endnotes for the passage. They record which
   variant readings were followed and how a choice was justified; evaluate that
   reasoning and report on it as part of the section.

**Never reverse the order.** Reading the draft first and then checking it against
the source reproduces the draft's errors instead of catching them.

## Systematic sweeps

Beyond the line-by-line review, run these across the full text and report them
in the report's sweeps section:

1. **Completeness** — every folio and section of the source accounted for in the
   draft. Do this mechanically, folio by folio, not impressionistically. This is
   the sweep where an automated review adds the most value.
2. **Terminology conformity** — for each term the draft's Terminology Notes match
   to an existing house entry, verify that rendering throughout the draft, with
   counts. For each term logged as new, spot-check via the glossary tools that an
   existing entry was not overlooked, and separately verify the proposed term is
   used consistently. See `shared-policies/terminology`.
3. **Internal consistency** — recurring epithets, formulae and refrains rendered
   uniformly.
4. **Names and mantras** — checked character by character against the source, per
   `translator-guidelines/IV.B-proper-names` and
   `translator-guidelines/IV.G-mantras-and-dharanis`.
5. **Notes** — the draft's notes verified against the passages they discuss. A
   note citing a source or witness not provided in the session is flagged for
   verification, never assumed correct.

State the limits of each sweep. A sweep that covered part of the text is
reported as partial, naming what was covered.

## House style

The report is an 84000 document and follows house style like anything else the
studio publishes:

- **Use typographer's quotation marks and apostrophes throughout** — ‘ ’ “ ” —
  never the straight typewriter forms, per
  `translator-guidelines/IV.A-spelling`. This holds for the findings, the
  quoted draft readings, and the sweeps alike.
  *Extended Wylie needs particular care*, wherever it appears. The *a-chung* (འ)
  transliterates as a **closing** single quotation mark — `’` (U+2019), its
  convexity to the right, a closing inverted comma. It is **not** a straight
  apostrophe `'` (U+0027), and **not** the opening `‘` (U+2018) that a word
  processor produces automatically, which it usually will, since an a-chung
  normally follows a space. Sweep the Wylie for `‘` and correct each one, and
  confirm the `’` survived generation of the `.docx`.
- Quote the draft's readings exactly as the draft has them. Do not silently
  normalize its punctuation or spelling into the quotation — if the punctuation
  is itself the finding, that is a Tier D item.

## The disciplines

The first three are policies: fetch them with `read-policies` at the start of the
session, since they are edited in place and the current text binds. The last
ships with this skill.

| | |
|---|---|
| `shared-policies/review-report` | The report's structure — the five tiers, what an item carries, the confidence markers, the ordering rule. The single most important discipline here |
| `shared-policies/terminology` | Locating the binding house rendering, which is what a Tier C finding is measured against |
| `shared-policies/uncertainty` | The `[?]` / `[??]` scheme a Stage 1 draft flags itself with, and what its notes are claiming |
| `reference/output.md` | The deliverables and how they are saved |

## Working order

1. List what the work has saved with `read-session-documents`, and read the
   Stage 0 record and the Stage 1 draft where they exist. See
   `reference/output.md`.
2. Retrieve the Tibetan source for the folio range under review.
3. Confirm the inputs above with the editor, and state any that are missing.
4. Agree the scope with the editor: the whole text, or a folio range.
5. Review section by section, source first, assembling findings into the tiers
   of `shared-policies/review-report`.
6. Run the systematic sweeps across the agreed scope.
7. Sort each tier into ascending source order and run the verification pass down
   the folio references, per `shared-policies/review-report`.
8. Assemble the global issues list from the findings, and write the
   cross-reference index.
9. Write the three deliverables to local files per `reference/output.md`.
10. Save them to storage with `write-session-documents`, passing the work's
    `toh`, `stage: stage2`, the files with `toh#_stage2.docx` as `primary` and
    the two markdown records as `supporting`, and your `model` — then PUT each
    file to the upload URL it returns. See `reference/output.md`; the save is not
    complete until every upload has succeeded, the `.docx` included.

## Not this

- **Do not produce a corrected version of the translation.** The output is a
  report; the draft is returned untouched. This holds even when asked for "the
  fixed text" — offer the findings instead.
- **Do not read the draft before construing the source.** A review that reversed
  the order cannot be repaired by re-reading afterwards; the construal is already
  anchored.
- **Do not edit the Stage 1 draft in storage**, or save anything under `stage1`.
  Stage 2 writes only its own stage.
- **Do not review against an etext the editor supplies** when retrieval from the
  studio is available.
- **Do not treat a Stage 1 `[??]` note as a finding in itself.** The draft
  flagging its own uncertainty is the draft working correctly; the finding, if
  there is one, is about the reading, and the flag belongs in Tier E where the
  question is genuinely open.
- **Do not report a sweep as complete when it was partial**, and do not present a
  spot-check as an exhaustive verification.
- **Do not assert a house glossary entry** that was not actually located through
  the studio glossary tools or the `glossary-by-canon-section` skill.
- **Do not overwrite an existing `toh#_stage2.md`** for the same work without
  confirming with the editor that a re-review is intended. Check with
  `read-session-documents` rather than by looking for a local file. Storage
  archives what a re-run replaces, so the previous report is recoverable — but a
  second reviewer's report replacing the first is rarely what anyone wanted.
- **Do not report the stage as saved** when an upload failed or the client could
  not make the PUT. A manifest exists either way; the file does not.
