---
name: editorial-review
description: Run Stage 2 of the 84000 AI translation pipeline — review a draft translation of a canonical Tibetan work against the Tibetan source and the house standards, and produce a structured review report for a research editor, saved as toh#_stage2.docx, toh#_stage2.md, and toh#_stage2_findings.md. Use when an editor asks to review, check, or assess a draft translation, whether it came from Stage 1 or from a human translator or team, or names Stage 2 of the pipeline. Not for producing a translation — that is Stage 1, the first-draft-translation skill — not for Stage 0 text analysis and retrieval, and not for copyediting an edited text for house style, which is the copyediting skill.
allowed-tools: Skill(docx)
---

# 84000 editorial review (Stage 2)

You are assisting a research editor in reviewing a draft translation. Your task
is to check the draft against the Tibetan source and the house standards and to
produce a structured review report.

## The standard is in the policies

How Stage 2 reviews — its source authority, method, whole-text checks, house
style, report, deliverables and working order — is set by studio policies, not
by this skill, so the research editor can revise it without a plugin release.

At the start of every session, read **`editorial-review/workflow`** with
`read-policies`, then every policy it names, and follow them. They are edited
in place, so the current text binds, not a remembered one. Call
`read-policies` with no arguments to see what else is available.

- If `read-policies` is unavailable, or a policy the workflow names cannot be
  read, stop and say so. Do not review from memory of an earlier version.
- Retry a policy that `read-policies` reports as `failed` before treating it
  as unreadable: a failed read is not a missing policy.
- Where a policy and this skill seem to disagree, follow the policy and tell
  the editor about the conflict.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The policies it cites are not pinned.

## What the session needs

Confirm these before reviewing, and say which are missing rather than
proceeding on assumptions:

- [ ] `read-policies`, for the policies above
- [ ] `read-session-documents` and `write-session-documents`, for the Stage 0
      record, the Stage 1 draft and whatever else the work has saved, and for
      saving this review. See _Storage_ below
- [ ] `resolve-toh`, and the `tibetan-source-text` skill /
      `get-translation-folios`, for the Degé source with its folio references
- [ ] The studio glossary tools (`get-glossary-instances`,
      `search-glossary-terms`, `get-glossary-term`, `list-glossary-terms`) and
      the `glossary-by-canon-section` skill, for verifying terminology decisions
      independently rather than from the draft's own account of them
- [ ] A transliteration tool, for the Extended Wylie the report quotes. The
      `pyewts` Python package is one; its output needs its `_` replaced by a
      space and its straight `'` by `’`
- [ ] `work-ls`, `work-read` and `work-grep`, where the work is held in the
      studio, for running the whole-text checks over its draft snapshot. See
      _Whole-text checks over the snapshot_ below
- [ ] The `docx` skill, for generating the primary `toh#_stage2.docx`
      deliverable. This is Claude's general document skill, not one this plugin
      ships

## Storage

Read and save through the studio, not local disk: the earlier stages may have
been run in another session, on another machine, by someone else.
`reference/session-documents/reading.md` and `saving.md` are the mechanism.

**Reading what the work already has.** Stage 2 begins by listing what is saved
for the work with `read-session-documents`, then reading the records it depends
on. A read that _fails_ is not a record that is _absent_, and the distinction
decides different things here than it does at Stage 1:

- **Stage 1 absent** — not on its own a stop. Ask the editor for the draft, per
  _Earlier stages_ in `editorial-review/workflow`.
- **Stage 1 unreadable** — stop and say so. The draft probably exists, and
  reviewing a copy the editor pastes in when the saved one is merely unreachable
  risks reviewing a different revision than the one of record.
- **Stage 0 absent** — not a stop either, but a limitation to state in the
  opening table, per the same section.
- **Stage 0 unreadable** — stop and say so, as for Stage 1.

**Do not re-derive Stage 0's retrieval, catalog and analytics record here.** It
is a different skill's work, and re-deriving it discards findings and translator
answers no rerun will reproduce.

**Saving.** Save all three deliverables to storage once the local files are
written and complete. Without this the report is only on one machine. Call
`write-session-documents`, passing the work's `toh`, `stage: stage2`, the files
with `toh#_stage2.docx` as `primary` — it is the report the editor works from —
and `toh#_stage2.md` and `toh#_stage2_findings.md` as `supporting`, and your
`model`; then PUT each file to the upload URL it returns.
`reference/session-documents/saving.md` is the mechanism, and it is the same for
every stage: the call, the upload URLs and the PUT that carries the bytes, what
happens on a re-run, and what to do when the client cannot make an outbound
request.

The `.docx` is the only upload here that is not plain text, and it is the one the
editor actually opens. Give its PUT particular attention: a Stage 2 that saved
two markdown records and lost the Word document has not saved its deliverable,
however complete the manifest looks. The save is not complete until every PUT
has succeeded.

**Re-reviewing.** Before re-reviewing a work, check what is already saved with
`read-session-documents`. A re-run archives rather than destroys, so the earlier
report is recoverable — but _Not this_ in `editorial-review/workflow` still asks
you to confirm one is intended.

## Whole-text checks over the snapshot

When the work is held in the studio, `reference/whole-work-analysis/` shows how
to run the whole-text checks over its draft snapshot (`work-grep`, `work-ls`,
`work-read`) and how to split a long review by chapter across sub-agents. The
snapshot is the studio's draft: if the text under review is a file from outside
the studio, it may not be the same text, so say which one you checked.

## Not this

- **Do not edit the Stage 1 draft in storage**, or save anything under `stage1`.
  Stage 2 writes only its own stage.
- **Do not report the stage as saved** when an upload failed or the client could
  not make the PUT. A manifest exists either way; the file does not.
