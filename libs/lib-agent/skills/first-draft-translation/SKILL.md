---
name: first-draft-translation
description: Produce a Stage 1 first-draft 84000 translation of a canonical Tibetan work — the whole text or a specified Degé folio range — for review by a research editor, as English with Degé folio markers, footnoted uncertainties and a terminology table, saved as toh#_stage1.docx and toh#_stage1.md (with the folio range in the filename for a range draft). Use only when a translator specifically asks for a first draft, or Stage 1, of a whole text or a folio range, by Toh number. A line or short passage is not a Stage 1 task — translate it ad hoc, without this skill. Not for editorial review of an existing draft — that is Stage 2, the editorial-review skill — and not for Stage 0 text analysis and retrieval, which must already have been run.
allowed-tools: Skill(docx)
---

# 84000 first-draft translation (Stage 1)

You are producing a first draft of an 84000 translation — of a whole text, or
of a folio range of one — for review by a research editor.

## The standard is in the policies

How Stage 1 drafts — its scope, source authority, register, document
structure, deliverables and working order — is set by studio policies, not by
this skill, so the research editor can revise it without a plugin release.

At the start of every session, read **`first-draft-translation/workflow`**
with `read-policies`, then every policy it names, and follow them. They are
edited in place, so the current text binds, not a remembered one. Call
`read-policies` with no arguments to see what else is available.

- If `read-policies` is unavailable, or a policy the workflow names cannot be
  read, stop and say so. Do not draft from memory of an earlier version.
- Retry a policy that `read-policies` reports as `failed` before treating it
  as unreadable: a failed read is not a missing policy.
- Where a policy and this skill seem to disagree, follow the policy and tell
  the translator about the conflict.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The policies it cites are not pinned.

## What the session needs

Confirm these before drafting, and say which are missing rather than
proceeding on assumptions:

- [ ] `read-policies`, for the policies above
- [ ] `read-session-documents` and `write-session-documents`, for the Stage 0
      record, earlier Stage 1 drafts, and saving this one. See _Storage_ below
- [ ] `resolve-toh`, and the `tibetan-source-text` skill /
      `get-translation-folios`, for the Degé source with its folio references
- [ ] The studio glossary tools (`get-glossary-instances`,
      `search-glossary-terms`, `get-glossary-term`, `list-glossary-terms`) and
      the `glossary-by-canon-section` skill
- [ ] The `kangyur-tengyur-recensions` skill, if the translator asks for the
      Stok Palace version to be consulted. It needs `download-snapshot` and a
      shell; the policies say what to do without it
- [ ] The `docx` skill, for the primary `.docx` deliverable. This is Claude's
      general document skill, not one this plugin ships

## Storage

Read and save through the studio, not local disk: Stage 0 may have been run in
another session, on another machine, by someone else.
`reference/session-documents/reading.md` and `saving.md` are the mechanism.

**Reading the Stage 0 record.** Read `toh#_stage0.md` out of storage before
anything else. A read that _fails_ is not a record that is _absent_, and the two
lead to different stops:

- **Stage 0 absent** — stop, and run Stage 0 first with the
  `text-analysis-and-retrieval` skill.
- **Stage 0 unreadable** — stop and say so. The record probably exists.

Either way, **do not re-derive Stage 0's retrieval, catalog, and analytics
record here.** It is a different skill's work, and re-deriving it discards
findings that no rerun will reproduce.

**Saving.** Save the deliverables with `write-session-documents`, passing the
work's `toh`, `stage: stage1`, the `.docx` as `primary` and the markdown record
as `supporting`, and your `model`, then PUT each file to the upload URL it
returns. The `.docx` is the only upload that is not plain text, and it is the
file the editor opens: a Stage 1 that saved the markdown record and lost the
Word document has not saved its deliverable, however complete the manifest
looks. The save is not complete until every PUT has succeeded.
