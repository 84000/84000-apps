---
name: text-analysis-and-retrieval
description: Run Stage 0 of the 84000 AI translation pipeline for a canonical Tibetan work — retrieve the Degé source by Toh number, register the work against the Toh catalog, and assemble the report a translator needs before drafting (catalog record, structural map, major themes, precedent translations, Kangyur and Tengyur resources, open questions), saved as toh#_stage0.md. Use when a translator or editor asks to analyze, scope, research, or prepare a text by Toh number before drafting begins, or names Stage 0 of the pipeline, or asks which recensions, related works or commentaries bear on a work. Not for producing a translation — that is Stage 1, the first-draft-translation skill — not for editorial review of an existing draft, which is Stage 2, the editorial-review skill, and not for collating witnesses, which is its own skill.
allowed-tools: Skill(docx)
---

# 84000 text analysis and retrieval (Stage 0)

You are producing the Stage 0 report for a text before any drafting begins.
Given a Tohoku (Toh) number, retrieve the Degé source, establish where the text
sits in the canon, map its structure, and assemble the canonical resources a
translator needs before committing to a drafting approach.

This stage produces no translation and no interpretive judgment about the
text's meaning. It produces a structured report: what the text is, how it is
built, what it treats at length, what already exists about it, and what the
translator or editor still needs to decide. Everything in it is verifiable
against the source, the catalog and the eText collections. Nothing is asserted
from memory.

**Stage 0 asks the translator nothing.** It runs from a Toh number alone, start
to finish, and can run unattended or in batches. Every decision it cannot
settle from its sources goes to the report's Open Questions, not to a prompt.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The policies it cites are not pinned:
> read them live with `read-policies` at the start of every session, since an
> edit to a policy binds from the next session.

## Principles

These govern every section of the report. Where an instruction below seems to
conflict with them, the principle wins, and the conflict is itself something to
report.

1. **Purpose.** Stage 0 serves the human translator before drafting, and it is
   the record Stages 1 and 2 build on. Anything that serves neither does not
   belong in it.
2. **The source is the only authority.** The Degé text is recorded as retrieved.
   Nothing is emended, normalized, reconciled or harmonized silently.
3. **Sourced, or an open question.** Every finding names its source: a tool, a
   folio, a document, a search. Nothing comes from memory. What cannot be
   sourced is recorded as an open question, not as a finding.
4. **Labeled by how it is known.** The report distinguishes what the catalog or
   the text states, what a secondary source says, and what Stage 0 inferred.
5. **Scope stated.** Each section says what was searched and what was not. A
   partial search is never presented as complete, and "none located" names
   where the search looked.
6. **The translator decides.** Stage 0 makes no selection and no judgment call
   on the translator's behalf. What needs a decision is put in Open Questions.
7. **Later stages keep working.** The sections Stages 1 and 2 read by name stay
   stable, and any change to them is made together with a matching change in
   the stage that reads them.
8. **Instructions ask only for what the tools can do.** A step the available
   tools cannot perform is reported as not run, with the reason, and goes on the
   tool-request list, not into a guess.
9. **Findings first, method second.** The report leads with what the translator
   needs. Method is confined to each section's scope line; there is no process
   appendix.
10. **Effort matches value.** Expensive steps carry a stated scope. Going beyond
    the default scope is for the translator or editor to ask for.

## Before you start

Confirm each of these at the start of the session:

- [ ] The Toh number of the work. This is the only input Stage 0 needs.
- [ ] The `tibetan-source-text` skill and the 84000 Studio catalog tools
      (`resolve-toh`, `get-translation`, `get-work-titles`, `get-imprint`,
      `get-translation-folios`, `search-entities`, `search-canon-sections`).
- [ ] The `kangyur-tengyur-recensions` skill, with `download-snapshot` and a
      shell. It reads the eText collections of the Kangyur, Tengyur and
      Nyingma Gyubum and their work catalog; the catalog's README lists the
      collections in the current build. Stage 0 depends on it for recensions
      and for title search over the Kangyur and Tengyur, and for the search of
      the Degé Tengyur folio text for works citing the base text. If it is not
      available in the session, the subsections that need it are reported as
      not run — see `shared-policies/canonical-resources`.
- [ ] A web search tool, for precedent translations outside of 84000 content. If
      none is available, that route is reported as not run.
- [ ] The `read-policies` tool. Read, at the start of the session:
      `shared-policies/transliteration`, `shared-policies/analytics`,
      `shared-policies/canonical-resources`, and the Guidelines excerpts
      `translator-guidelines/IV.A-spelling` and
      `translator-guidelines/IV.H-content-layout-and-folio-markers`. Call it
      with no arguments to see what else is available.
- [ ] The `read-session-documents` and `write-session-documents` tools,
      for checking what the work already has saved and for saving the report.
      See `reference/output.md`.

**Base text.** The base text is the Degé, under the project's source-authority
rule. If the person running Stage 0 names a different base text, record that in
the Catalog Record and proceed; do not ask.

**An existing record.** Before running, check with `read-session-documents`
whether a `toh#_stage0.md` is already saved for this work. If one is, say so
and confirm that a re-run is intended before continuing. When Stage 0 runs
unattended or in a batch, a work that already has a record is re-run only if
the request explicitly asked for a re-run; otherwise it is skipped and
reported as already having one. Storage archives what a re-run replaces, so
the previous record is recoverable, but the person should know a re-run is
happening.

## Retrieval

- Resolve the Toh number first with `resolve-toh`. A cited number is often not
  an entry of its own: it may be superseded, one of several a single entry
  covers, or a subdivided or lettered entry. Pass the resolved number onward.
- **If the number resolves to more than one work, or to none, stop and
  report it.** Do not choose.
- Fetch the Degé text — Kangyur or Tengyur, Uchen Unicode — for the resolved
  number with the `tibetan-source-text` skill, every folio side from the first
  to the last. Record the volume and the folio range as returned.
- Record every placement `resolve-toh` reports. A work catalogued at more than
  one point in the canon has a bibliographic reference for each, and each is
  given in the Catalog Record.

## Catalog registration

- Record the canonical section **exactly as the catalog names it** via
  `get-translation`. Do not infer the section from the title or the content.
- Record the titles exactly as `get-work-titles` gives them, then transliterate
  the Tibetan per `shared-policies/transliteration`.
- Record the translators' colophon from the text itself, in full. The catalog's
  translator field is not used: it is empty for most unpublished works.
- **If the catalog and the source disagree** on volume or folio placement,
  flag the discrepancy in Open Questions. Do not reconcile it. A clean result
  gets no line.

## The report

`reference/output.md` specifies the report, section by section, with the field
order and the wording of each. In summary:

| §   | Section                       | Governed by                           |
| --- | ----------------------------- | ------------------------------------- |
| 1   | Catalog Record                | `reference/output.md`                 |
| 2   | Structural Map                | `shared-policies/analytics`           |
| 3   | Major Themes                  | `shared-policies/analytics`           |
| 4   | Precedent Translations        | `shared-policies/analytics`           |
| 5   | Kangyur and Tengyur Resources | `shared-policies/canonical-resources` |
| 6   | Open Questions                | `reference/output.md`                 |

## House style

- **All Tibetan in the report is in Extended Wylie (EWTS), never Uchen
  Unicode**, transliterated mechanically and checked against the Unicode, per
  `shared-policies/transliteration`. That policy also fixes the house profile:
  the _a-chung_ as `’` (U+2019), EWTS in italics, the treatment of the final
  shad, and explicit stacking for Sanskrit written in Tibetan script.
- Typographer's quotation marks and apostrophes throughout — ‘ ’ “ ” — never
  the straight typewriter forms, per `translator-guidelines/IV.A-spelling`.
  The catalog stores Wylie with straight apostrophes; normalize them.
- Bibliographic references follow the _Cumulative Bibliography and Citation
  Templates_, the default authority for citation form.
- Folios are cited in the house form of
  `translator-guidelines/IV.H-content-layout-and-folio-markers`, `F.69.a`,
  and ranges as `F.69.a–90.b`.

## Working order

1. Check storage for an existing record; confirm a re-run if there is one.
2. Resolve the Toh number and retrieve the Degé text in full.
3. Register the work against the catalog and build **§1 Catalog Record**.
4. Run the structural sweep and build **§2 Structural Map**, per
   `shared-policies/analytics`.
5. Read the divisions and build **§3 Major Themes**, per
   `shared-policies/analytics`.
6. Search for **§4 Precedent Translations**, per `shared-policies/analytics`:
   the 84000 bibliographies first, then the open web.
7. Build **§5 Kangyur and Tengyur Resources**, per
   `shared-policies/canonical-resources`: recensions of the base text first,
   then the Kangyur subsections, then the Tengyur subsections, with the
   anchoring test run for every exegetical work found.
8. Collect **§6 Open Questions** from the flags raised in steps 2–7.
9. Transliterate and check every Tibetan string, sweep the report for straight
   apostrophes and opening quotation marks in Wylie, and assemble
   `toh#_stage0.md` and its Word mirror per `reference/output.md`.
10. Save the deliverables to storage with `write-session-documents`, then PUT
    each file to the upload URL it returns. The save is not complete until
    every upload has succeeded. See `reference/output.md`.

## Not this

- **Do not begin drafting** a translation, summary or introduction. That
  belongs to later stages.
- **Do not interpret the text.** The Structural Map and Major Themes say what
  the text contains and where; never what it means, how it relates
  doctrinally to other works, or why it matters.
- **Do not infer the canonical section** from the title or your own reading of
  the text. Take it from the catalog.
- **Do not assert that a translation, a related work or a commentary exists**
  without a source you can cite. A secondary mention that cannot itself be
  reached is not recorded, even as a lead.
- **Do not silently resolve a discrepancy** between the catalog and the source.
  Flag it in Open Questions.
- **Do not present a partial search as exhaustive.** Each section's scope line
  states what was searched. "None located" names where the search looked.
- **Do not promise that a commentary's passages can be located** from a
  root-text folio range without having run the anchoring test, and do not
  present a commentary without disclosing a failed or unrun test.
- **Do not select commentaries, witnesses or anything else for the
  translator.** Stage 0 lists; Stage 1 asks the translator to choose.
- **Do not ask the translator questions.** Put what needs a decision in Open
  Questions.
- **Do not collate witnesses.** Stage 0 lists the recensions that exist;
  collation is a separate skill.
- **Do not write Tibetan in Unicode anywhere in the report**, and do not
  transliterate by hand.
- **Do not add a process or method appendix.** Scope lines carry coverage.
- **Do not overwrite an existing `toh#_stage0.md`** without confirming that a
  re-run is intended.
- **Do not report the stage as saved** when an upload failed or the client
  could not make the PUT.
