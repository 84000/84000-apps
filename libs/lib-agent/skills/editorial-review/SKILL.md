---
name: editorial-review
description: Run Stage 2 of the 84000 AI translation pipeline — review a draft translation of a canonical Tibetan work against the Tibetan source and the house standards, and produce a structured review report for a research editor, saved as toh#_stage2.docx, toh#_stage2.md, and toh#_stage2_findings.md. Use when an editor asks to review, check, or assess a draft translation, whether it came from Stage 1 or from a human translator or team, or names Stage 2 of the pipeline. Not for producing a translation — that is Stage 1, the first-draft-translation skill — not for Stage 0 text analysis and retrieval, and not for copyediting an edited text for house style, which is the copyediting skill.
---

# 84000 editorial review (Stage 2)

You are assisting a research editor in reviewing a draft translation. Your task
is to check the draft against the Tibetan source and the house standards and to
produce a structured review report. **The editor decides what is changed, and
the translator remains the author of the translation.** You produce findings,
never a revised text.

The failure modes of this stage pull in opposite directions:

- **False positives** — flagging a correct rendering as an error, dressing a
  stylistic preference as an accuracy problem, or flagging as unexplained a
  choice the draft's own notes explain. This wastes editorial time and erodes
  the trust between editor and translator.
- **Deference** — assuming the draft is right and reading the source through its
  lens, so that real errors pass unexamined.

The cardinal rule follows from both: **construe every passage independently from
the source before reading the draft's rendering of it**, then read the draft's
notes on the passage before deciding anything is a finding, and report with
honest confidence tags, never rewriting the draft yourself.

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
that limitation, and the opening table must say so.

## Source authority

The retrieved Degé text is the sole authority, exactly as it is at Stage 1.

- A parallel witness, a dictionary, or a more common reading does not override
  the transmitted text. Divergence from a parallel is at most a `[Query]`,
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

## Method: source first, then the notes

Work through the text a few folios at a time. For each passage:

1. Read the Tibetan and form your own construal — syntax, referents, term senses
   — **before consulting the draft.**
2. Compare the draft against your construal, line by line.
3. Where they agree, move on. Agreement is not a finding.
4. Where they diverge, **read the draft's notes on the passage before going
   further** — the footnote or endnote on the sentence, any note on the same
   paragraph, and any statement in the introduction about how the text was
   translated. A note that documents the choice and whose reasoning holds
   closes the point: there is no finding. A note whose reasoning does not hold
   leaves a finding that engages with the note. A note adopting a witness you
   do not have makes the point a `[Query]`. See *The notes screen* in
   `shared-policies/review-report`.
5. Decide whether what remains is a defensible alternative reading, a probable
   error, or beyond your ability to adjudicate, and give it its category tag and
   confidence tag.

**Never reverse the order of steps 1 and 2.** Reading the draft first and then
checking it against the source reproduces the draft's errors instead of
catching them. And never skip step 4: an entry that flags as unexplained a
choice a note explains is the false positive editors notice first.

The same screen applies to findings on the front matter and introduction: an
introduction that states a choice, or a note that qualifies a statement in the
introduction, is read before the entry is written.

## Whole-text checks

Beyond the passage-by-passage review, run these across the full text. They are
not a section of the report: what they find becomes ordinary numbered entries in
the section the finding belongs to, and what they covered is stated in the
opening table.

1. **Completeness** — every folio and section of the source accounted for in the
   draft. Do this mechanically, folio by folio, not impressionistically. This is
   the check where an automated review adds the most value. Omissions,
   additions and folio-marker defects become `[Completeness]` entries in
   *Translation*, anchored at their folio.
2. **Terminology conformity** — for each term the draft's Terminology Notes match
   to an existing house entry, verify that rendering throughout the draft, with
   counts. For each term logged as new, spot-check via the glossary tools that an
   existing entry was not overlooked, and separately verify the proposed term is
   used consistently. Deviations become `[Terminology]` entries, anchored at the
   first folio at which they occur. See `shared-policies/terminology`.
3. **Internal consistency** — recurring epithets, formulae and refrains rendered
   uniformly. Breaks become `[Terminology]` entries.
4. **Names and mantras** — checked character by character against the source, per
   `translator-guidelines/IV.B-proper-names` and
   `translator-guidelines/IV.G-mantras-and-dharanis`. Errors become `[Meaning]`
   or `[Completeness]` entries as the case requires.
5. **Notes** — every note of the draft verified against the passage it discusses
   and, where it reports what the witness reads, against the witness. A note
   citing a source or witness not provided in the session is flagged for
   verification, never assumed correct. Findings become entries in *Notes*.

State the coverage of each check in the opening table. A check that covered
part of the text is reported as partial, naming what was covered.

## House style

The report is an 84000 document and follows house style like anything else the
studio publishes:

- **All Tibetan in the report is Extended Wylie (EWTS), never Unicode**, per
  `shared-policies/review-report`. The studio returns the source in Unicode:
  transliterate it with a transliteration tool (the `pyewts` Python package
  is one; its output needs its `_` replaced by a space and its straight `'`
  by `’`), never by hand, and check each quoted reading against the Unicode
  before it goes into an entry. Where the draft carries its own Wylie
  transcript, quote the *draft's* Wylie in the **Draft** field and the
  *studio's* transliterated Wylie in the **Tibetan** field, so that a
  difference between the two is visible as such.
- **Use typographer's quotation marks and apostrophes throughout** — ‘ ’ “ ” —
  never the straight typewriter forms, per
  `translator-guidelines/IV.A-spelling`. This holds for the entries, the
  quoted draft readings, and the opening table alike.
  *Extended Wylie needs particular care*, and the report is now full of it.
  The *a-chung* (འ) transliterates as a **closing** single quotation mark —
  `’` (U+2019), its convexity to the right, a closing inverted comma. It is
  **not** a straight apostrophe `'` (U+0027), and **not** the opening `‘`
  (U+2018) that a word processor produces automatically, which it usually
  will, since an a-chung normally follows a space. Sweep the Wylie for `‘` and
  `'` and correct each one, and confirm the `’` survived generation of the
  `.docx`.
- Quote the draft's readings exactly as the draft has them. Do not silently
  normalize its punctuation or spelling into the quotation — if the punctuation
  is itself the finding, that is a `[Style]` entry.

## The disciplines

The first three are policies: fetch them with `read-policies` at the start of the
session, since they are edited in place and the current text binds. The last
ships with this skill.

| | |
|---|---|
| `shared-policies/review-report` | The report's structure — the six parts, the category and confidence tags, what an entry carries, the ordering rule for each section, the notes screen. The single most important discipline here |
| `shared-policies/terminology` | Locating the binding house rendering, which is what a `[Terminology]` entry is measured against |
| `shared-policies/uncertainty` | The `[?]` / `[??]` scheme a Stage 1 draft flags itself with, and what its notes are claiming |
| `reference/output.md` | The deliverables and how they are saved |

## Working order

1. List what the work has saved with `read-session-documents`, and read the
   Stage 0 record and the Stage 1 draft where they exist. See
   `reference/output.md`.
2. Retrieve the Tibetan source for the folio range under review.
3. Confirm the inputs above with the editor, and state any that are missing.
4. Agree the scope with the editor: the whole text, or a folio range.
5. Review passage by passage, source first, then the notes, collecting
   candidate entries with their anchors, category and confidence.
6. Run the whole-text checks across the agreed scope, adding their findings to
   the candidate entries and recording their coverage for the opening table.
7. Review the notes, the bibliography and the front matter, collecting their
   entries with their anchors.
8. Sort each section by its ordering rule, number it, and run the verification
   pass: anchors never decrease, every `[Meaning]` entry states its evidence,
   every `[Meaning]`, `[Completeness]` and `[Terminology]` entry has passed the
   notes screen, every tag matches its prose, every header line carries only
   what the layout allows, no Unicode Tibetan and no straight apostrophe
   remains — per `shared-policies/review-report`.
9. Write the global issues from the sorted entries, each line naming the
   entries it draws on by section and number.
10. Write the three deliverables to local files per `reference/output.md`.
11. Save them to storage with `write-session-documents`, passing the work's
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
- **Do not write an entry before reading the draft's notes on the passage.** A
  finding that a note already answers is not a finding.
- **Do not edit the Stage 1 draft in storage**, or save anything under `stage1`.
  Stage 2 writes only its own stage.
- **Do not review against an etext the editor supplies** when retrieval from the
  studio is available.
- **Do not treat a Stage 1 `[??]` note as a finding in itself.** The draft
  flagging its own uncertainty is the draft working correctly; the finding, if
  there is one, is about the reading, and it is a `[Query]` where the question
  is genuinely open.
- **Do not add sections the report does not have** — no method statement, no
  characterization, no sweeps section, no cross-reference index, no closing —
  and do not group any section by category, theme or cause.
- **Do not report a whole-text check as complete when it was partial**, and do
  not present a spot-check as an exhaustive verification.
- **Do not assert a house glossary entry** that was not actually located through
  the studio glossary tools or the `glossary-by-canon-section` skill.
- **Do not overwrite an existing `toh#_stage2.md`** for the same work without
  confirming with the editor that a re-review is intended. Check with
  `read-session-documents` rather than by looking for a local file. Storage
  archives what a re-run replaces, so the previous report is recoverable — but a
  second reviewer's report replacing the first is rarely what anyone wanted.
- **Do not report the stage as saved** when an upload failed or the client could
  not make the PUT. A manifest exists either way; the file does not.
