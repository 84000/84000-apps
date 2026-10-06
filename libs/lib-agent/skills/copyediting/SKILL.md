---
name: copyediting
description: Copyedit an edited 84000 translation — body text, notes, front matter, bibliography and glossary — for conformity with the Translator Guidelines and the copyeditor stylesheet, separating mechanical changes from queries, either as a tracked-revision Word file with comments (toh#_copyedited_tracked.docx plus toh#_copyedit_review.docx) or as a suggestions report that leaves the file untouched (toh#_copyedit_review.docx). Use when an editor or copyeditor asks to copyedit, proof against house style, or check a post-editorial translation for conformity, or asks for tracked changes or a suggestions report on one. Not for reviewing the accuracy of a draft against the Tibetan — that is Stage 2, the editorial-review skill — and not for producing a translation, which is Stage 1, the first-draft-translation skill.
---

# 84000 copyediting

You are copyediting an edited 84000 translation for conformity with the
Translator Guidelines and the copyeditor stylesheet. Your output goes to a human
copyeditor or markup editor, who decides what stands.

Each stage of the pipeline has its own characteristic failure. In drafting it is
mistranslation; in front matter, fabricated scholarship. **In copyediting it is
overcorrection** — silently changing meaning while "fixing" style, normalizing a
deliberate scholarly choice, or improving prose nobody asked to have improved.

The cardinal rule follows: **minimal intervention.** Fix only what the
Guidelines and stylesheet demonstrably require, and query everything else.
Never alter meaning, and never rewrite for taste.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The report standard it follows is not —
> it is the live policy `shared-policies/copyedit-report`, read at the start of
> every session. Check you are on the current plugin version if an editor
> refers to guidance you find in neither.

## First: ask which mode

A copyedit runs in one of two modes. **Before confirming inputs, ask which is
wanted**, unless the opening request already states it. Do not infer the mode
from the file, from the text's stage, or from an earlier session.

1. **Tracked revision.** You return the supplied file with each correction as a
   Word tracked change and each query as a comment, plus a review logging them.
2. **Suggestions report.** You leave the file untouched and return a report of
   suggested revisions for the editor to make by hand.

Put the question briefly, in plain terms — for example: "Which kind of copyedit
review do you want? (1) Tracked revision: I return your file with each
correction as a tracked change and each query as a comment, plus a review
logging the changes. (2) Suggestions report: I leave your file untouched and
give you a report of suggested revisions to make yourself."

A request states the mode only if it says whether the file is to be changed:
"with tracked changes" is mode 1; "report only" or "don't change the file" is
mode 2. If the wording leaves that unclear, ask.

## Before you start

Once the mode is settled, confirm each of these:

- [ ] **The text to be copyedited** — the post-editorial version, as a `.docx`
      the editor supplies. Mode 1 builds its output from this very file, so it
      must be the file itself, not a paste
- [ ] **Its status.** If it has not been through editorial review, say so and
      ask whether to proceed; if the editor confirms, state the status in the
      review's header. If it is at a later stage — already copyedited, or
      approved for markup — proceed, and state its status in the header
- [ ] **The Translator Guidelines** (v. 10.31), through the `read-policies`
      studio tool — see *The disciplines*. Consult the full document for
      anything beyond the sections it returns
- [ ] **The copyeditor stylesheet**, through `read-policies` — the four
      `copyeditor-stylesheet/` policies. If the editor supplies a newer
      spreadsheet or a project-specific stylesheet, it governs where it differs;
      say which was used. If neither can be read, a change can cite only the
      Guidelines, anything the stylesheet would have settled becomes a query,
      and the review says so
- [ ] **The text's glossary tables**, normally in the supplied file. Where the
      work already has a studio glossary, `get-glossary-instances` and
      `get-glossary-term` show it — but the glossary the sweep measures against
      is the text's own
- [ ] **Any editorial notes** recording deliberate departures from house style
- [ ] **The Tibetan source**, retrieved from the studio via the
      `tibetan-source-text` skill / `get-translation-folios` — **for verifying
      proper names, mantras and folio milestones only, never for
      retranslation**
- [ ] **What the work already has saved**, through `read-session-documents` —
      in particular a Stage 2 review of the same text, which mode 2 relates its
      report to. See `reference/output.md`
- [ ] The `docx` skill, for reading the supplied file and generating the Word
      deliverables, including tracked changes and comments. This is Claude's
      general document skill, not one this plugin ships
- [ ] The `write-session-documents` studio tool, for saving the deliverables

**If editorial notes are not provided, say so before starting.** Without them an
error cannot be told from a documented decision, so every doubtful case must be
queried rather than changed — and the review has to say it ran under that
limitation.

## The disciplines

Fetch the policies with `read-policies` at the start of the session: they are
edited in place, so the current text binds, not a remembered one. Call it with
no arguments to see what else is available.

| | |
|---|---|
| `shared-policies/copyedit-report` | What counts as a change and what is always a query, the tags, both modes' deliverables and layout, the sweep table, the tone. The single most important discipline here |
| `copyeditor-stylesheet/terminology`, `style-and-grammar`, `references`, `scientific-names` | The copyeditor stylesheet: fixed spellings and forms of terms, names, places and references; grammar, capitalization and italics, punctuation, formatting, and notes and citations; bibliography order; the verified scientific names of flora and fauna. Where it is more specific than the Guidelines, it is what a change cites |
| `translator-guidelines/IV.A-spelling` through `IV.H-content-layout-and-folio-markers` | The house rules most changes cite: spelling, numbers, dates and abbreviations (IV.A); proper names (IV.B); capitalization (IV.C); text titles (IV.D); italics (IV.E); punctuation (IV.F); mantras and dhāraṇīs (IV.G); layout, headings, folio and _bam po_ markers (IV.H) |
| `translator-guidelines/IV.J-order-of-elements`, `V.A-titles`, `V.D-summary`, `V.E-acknowledgments` | The front matter: its order, the title forms, the summary and the acknowledgments |
| `translator-guidelines/V.G-notes`, `V.I-bibliography` | Note form, sigla, short citations and cross-reference codes; bibliography entry form and order |
| `translator-guidelines/V.H-glossaries` | Glossary columns and the form of each — what the glossary sweep checks the glossary itself against |
| `translator-guidelines/appendix-2-tibetan-phonetics` | The phonetics scheme, for the phonetics-vs-Wylie sweep |
| `shared-policies/terminology` | Locating the binding house rendering, when a term's glossary entry is itself in doubt |
| `reference/output.md` | The deliverables, how they are built and checked, and how they are saved |

A change cites its rule precisely enough for the copyeditor to check it: the
Guidelines by section ("Guidelines IV.F"), the stylesheet by sheet and entry
("stylesheet, Terminology: toward"; "stylesheet, Style and Grammar:
Ellipses"). The Guidelines defer to _The Chicago Manual of Style_ for anything
they do not cover (IV.K), and the stylesheet cites it by section; a change
resting on CMOS alone cites the section, or is a query when the section cannot
be given.

## Source authority

The retrieved Degé text is the authority for the three things it is consulted
on — proper names, mantras, folio milestones — exactly as at the earlier stages.

- **Do not correct Tibetan or Sanskrit source-language forms toward standard
  spellings.** The source-as-transmitted rule applies here too.
- A mantra reading that differs from the Degé is a query, unless the difference
  is one of transcription format only.
- Anything that looks like a mistranslation is a query tagged
  `[beyond copyedit scope]`. Do not touch the text, and do not go looking: the
  copyedit is not a review of the translation.
- **If source retrieval fails, say so** and report the sweeps that depend on it
  as not run, rather than checking against an etext supplied in-session.

## Method

1. **Read the whole file before intervening anywhere.** The text's own dominant
   usage is one of the standards a change is measured against, and a variant can
   only be seen as a stray once the pattern it strays from is known. Read the
   glossary, the notes and the editorial notes on the way: they are where a
   deliberate choice is documented.
2. **Work through the file in order** — front matter and introduction,
   translation, notes, bibliography, glossary — collecting candidate
   interventions with their locations.
3. **Classify each one** as a change or a query under
   `shared-policies/copyedit-report`. Before calling anything a change, find
   the rule it cites; before calling a variant inadvertent, count it against
   the conformant instances; before calling anything an error, check whether an
   editorial note or a note to the passage records it as deliberate. Whatever
   fails any of these is a query.
4. **Run the sweeps** below across the whole text, adding what they find to the
   candidates.
5. **Write the deliverables for the mode** — see `reference/output.md`.

## Consistency sweeps

Run all seven across the whole text, mechanically, and report every one in the
sweep table even when it finds nothing. What a sweep finds becomes an ordinary
entry; the table cites it by number.

1. **Glossary conformity** — every glossed term against its fixed rendering
   throughout the text; conformant and deviant counts in total, and per term
   only for the terms that deviate. One stray variant among many conformant
   instances may be a change; a systematic deviation is a query.
2. **Diacritics** — every Sanskrit form against the glossary and IAST,
   character by character.
3. **Phonetics vs. Wylie** — Tibetan names rendered in phonetics or Wylie per
   the contexts the Guidelines assign each (IV.B, V.G, V.I,
   `appendix-2-tibetan-phonetics`), and names given as phonetics followed by
   lowercase Wylie in parentheses where the stylesheet asks for it.
4. **Milestones and numbering** — folio milestones present, formatted per IV.H,
   and in sequence against the source; section and note numbers continuous.
5. **Cross-references** — every internal reference resolves to an existing
   section or note.
6. **Front matter/body agreement** — titles, Toh number and terminology
   consistent across the summary, the introduction and the translation.
7. **Notes and bibliography** — every citation in the notes has a bibliography
   entry and every entry is cited; formatting per V.G and V.I. **Verify presence
   and formatting only — never complete bibliographic data from memory.**

A sweep that could not be run, or ran only in part, says so and why — a missing
input, a failed retrieval. Never present a partial sweep as complete.

## House style in the review

The review is an 84000 document and follows house style like anything else the
studio publishes.

- **Quote readings exactly as the file has them.** Do not silently normalize
  their spelling or punctuation into the quotation — when the punctuation is
  the issue, the quotation must show it.
- **Use typographer's quotation marks and apostrophes** — ‘ ’ “ ” — per
  `translator-guidelines/IV.F-punctuation`, in the entries, the tables and the
  comments alike.
- **Wylie needs particular care.** The _a-chung_ is the closing single quotation
  mark `’` (U+2019), never a straight `'` and never the opening `‘` a word
  processor substitutes after a space. Where the file itself gets this wrong,
  that is a change; where your own report gets it wrong, it is a defect. Sweep
  the review for both before saving.

## Working order

1. Ask which mode, unless the request states it.
2. List what the work has saved with `read-session-documents`, and read a Stage
   2 review where one exists.
3. Confirm the inputs above, read the policies, and state anything missing —
   editorial notes and the stylesheet in particular.
4. Retrieve the Tibetan source for the folio range, for names, mantras and
   milestones.
5. Read the whole file, then work through it in order, collecting and
   classifying candidates.
6. Run the seven sweeps.
7. Number the entries per `shared-policies/copyedit-report` — changes in
   document order, queries ranked (mode 1) or in document order (mode 2) — and
   write the global issues (mode 2) from the numbered entries.
8. Build the deliverables per `reference/output.md`, and run the checks it lists
   — for mode 1, accept-all and reject-all against the change log and the
   original, the validator, and LibreOffice.
9. Save them with `write-session-documents`, passing the work's `toh`,
   `stage: copyedit`, the files in their roles, and your `model` — then PUT each
   file to the upload URL it returns. The save is not complete until every
   upload has succeeded.

## Not this

- **Do not rewrite prose** for elegance, concision or flow. Style-level
  improvement is not copyediting.
- **Do not make a change you cannot tie to a specific rule.** It is a query.
- **Do not harmonize deliberate variation** — a term rendered two ways in
  different contexts, as the notes document.
- **Do not supply missing information from memory** — dates, page numbers, name
  spellings, bibliographic details. Query it.
- **Do not merge changes and queries.** The copyeditor must be able to accept
  the mechanical layer at a glance and then work through the judgment calls
  separately.
- **Do not retranslate, and do not review the translation.** The source is
  consulted for names, mantras and milestones only.
- **Do not alter the supplied file in mode 2**, and in mode 1 do not alter
  anything in it that is not in the change log — and never retype or regenerate
  it.
- **Do not put a comment inside an endnote** in the tracked file; anchor it on
  the note number in the main text.
- **Do not guess the reviewer's model name.** Give it as the session's system
  information gives it, or say it is not available.
- **Do not report the copyedit as saved** when an upload failed or the client
  could not make the PUT.
