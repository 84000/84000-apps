---
name: copyediting
description: Copyedit an edited 84000 translation — body text, notes, front matter, bibliography and glossary — for conformity with the Translator Guidelines and the copyeditor stylesheet, separating mechanical changes from queries, either as a tracked-revision Word file with comments (toh#_copyedited_tracked.docx plus toh#_copyedit_review.docx) or as a suggestions report that leaves the file untouched (toh#_copyedit_review.docx). Use when an editor or copyeditor asks to copyedit, proof against house style, or check a post-editorial translation for conformity, or asks for tracked changes or a suggestions report on one. Not for reviewing the accuracy of a draft against the Tibetan — that is Stage 2, the editorial-review skill — and not for producing a translation, which is Stage 1, the first-draft-translation skill.
allowed-tools: Skill(docx)
---

# 84000 copyediting

You are copyediting an edited 84000 translation for conformity with the
Translator Guidelines and the copyeditor stylesheet. Your output goes to a human
copyeditor or markup editor, who decides what stands.

## The standard is in the policies

How a copyedit is done — its two modes, inputs, source authority, method,
consistency sweeps, the review and its format, and working order — is set by
studio policies, not by this skill, so the research editor can revise it
without a plugin release.

At the start of every session, read **`copyediting/workflow`** with
`read-policies`, then every policy it names, and follow them. They are edited
in place, so the current text binds, not a remembered one. Call
`read-policies` with no arguments to see what else is available.

- If `read-policies` is unavailable, or a policy the workflow names cannot be
  read, stop and say so, unless the workflow says how to proceed without that
  policy, as it does for the copyeditor stylesheet. Do not copyedit from memory
  of an earlier version.
- Retry a policy that `read-policies` reports as `failed` before treating it
  as unreadable: a failed read is not a missing policy.
- Where a policy and this skill seem to disagree, follow the policy and tell
  the editor about the conflict.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The policies it cites are not pinned.
> Check you are on the current plugin version if an editor refers to guidance
> you find in neither.

## What the session needs

Confirm these before starting, and say which are missing rather than
proceeding on assumptions:

- [ ] `read-policies`, for the policies above
- [ ] `read-session-documents` and `write-session-documents`, for what the work
      already has saved and for saving the deliverables. See _Storage_ below
- [ ] The `tibetan-source-text` skill / `get-translation-folios`, for the Degé
      source
- [ ] `get-glossary-instances` and `get-glossary-term`, where the work already
      has a studio glossary
- [ ] `work-grep`, `work-ls` and `work-read`, when the work is held in the
      studio, and optionally `download-snapshot` with a shell. See _The work
      snapshot_ below
- [ ] The `docx` skill, for reading the supplied file and generating the Word
      deliverables, including tracked changes and comments. This is Claude's
      general document skill, not one this plugin ships
- [ ] LibreOffice (`soffice`), for page references and for checking that the
      tracked file opens
- [ ] A shell, for `eft` in mode 1 — see _Checks before delivery_

## Storage

Read and save through the studio, not local disk: an earlier stage or an
earlier copyedit may have run in another session, on another machine, or for
someone else.

**Reading.** List what is saved for the work with `read-session-documents`.
`reference/session-documents/reading.md` is the mechanism, including the
distinction between a record that is absent and one that could not be read.
What to read, and what each outcome means, is in `copyediting/deliverables`.

**Saving.** Save the deliverables once the local files are written and checked.
`reference/session-documents/saving.md` is the mechanism — the call, the upload
URLs, the PUT that carries the bytes, what a re-run does, and what to do when
the client cannot make an outbound request.

What this stage supplies:

|         |                                                                                  |
| ------- | -------------------------------------------------------------------------------- |
| `toh`   | the work's Toh number. For a text with two, the first — the filenames carry both |
| `stage` | `copyedit`                                                                       |
| `files` | per the table below, with the roles given there                                  |
| `model` | your model name                                                                  |

| Mode               | File                                                                                 | Role         |
| ------------------ | ------------------------------------------------------------------------------------ | ------------ |
| Tracked revision   | `toh#_copyedited_tracked.docx` — the supplied file with tracked changes and comments | `primary`    |
|                    | `toh#_copyedit_review.docx` — the review                                             | `supporting` |
|                    | `toh#_copyedit_review.md` — the review's markdown text                               | `supporting` |
| Suggestions report | `toh#_copyedit_review.docx` — the review                                             | `primary`    |
|                    | `toh#_copyedit_review.md` — the review's markdown text                               | `supporting` |

Write these files to `84000/deliverables/<toh>/`, where `<toh>` is the
filenames' prefix, and downloads, chapter findings and other working files
where `reference/local-files/layout.md` puts them. Read the supplied file where
it is.

Then PUT each file to the upload URL it returns. The `.docx` files are the
uploads that matter: the tracked file in mode 1, the review in mode 2, is what
the copyeditor opens. A copyedit that saved its markdown and lost a Word
document has not saved its deliverable, however complete the manifest looks.
The save is not complete until every upload has succeeded. **Do not report the
copyedit as saved** when an upload failed or the client could not make the PUT.

## Building the tracked file (mode 1)

Use the `docx` skill's guidance for editing an existing document with tracked
changes and comments. **Work on the supplied file's XML in place** — unpack it,
edit `word/document.xml` and the parts it needs, repack — so that everything
outside the change log survives byte for byte: styles, fields, bookmarks,
section properties, the endnotes. Never rebuild the document from extracted
text.

- **Wording, spelling, punctuation**: derive each change from a character
  diff of the paragraph's old and new text, trim the common prefix and
  suffix, and track only the remainder, widened to the whole word only where
  `shared-policies/copyedit-report` calls for it. Never use the change log's
  Before and After as the span: they quote context so the change can be
  found. The removed text goes in a `w:del` (as `w:delText`) and the added
  text in a `w:ins`, each with `w:author="Claude"` and a `w:date`. A deletion
  spanning runs is placed in full before its insertion, never split around
  it. Give `xml:space="preserve"` to any `w:t` or `w:delText` that begins or
  ends with a space.
- **Splitting a run**: split at the exact character offset, counting each
  `w:br`, `w:tab` and note reference as a position. **Never rebuild a run from
  its text.** A split copies the whole run: its `w:rPr`, and every non-text
  child (`w:br`, `w:cr`, `w:tab`, `w:sym`, `w:footnoteReference`,
  `w:endnoteReference`, `w:fldChar`, `w:instrText`,
  `w:lastRenderedPageBreak`) stays in order on the side where it stood.
- **Stray spaces** (doubled, trailing, before punctuation): a `w:del` around
  the one space character and nothing else.
- **Formatting only**: change the run's `w:rPr` and record the previous
  properties in a `w:rPrChange` with the same author.
- **Comments**: one `w:comment` per query location in `word/comments.xml`,
  author "Claude", opening with its query number (`Q3`, or `Q3 (cont.)`), with
  `w:commentRangeStart`/`w:commentRangeEnd` around the passage and a
  `w:commentReference` run after it. Add the comments part, its relationship
  and its content-type override if the file has none.
- **Never put a comment range or reference inside `word/endnotes.xml`.**
  Anchor it on the note's reference mark in the main text.

### Checks before delivery

All five, every time. A tracked file that fails one is not delivered.

Checks 1, 2 and 5 run on `eft docx check-tracked`, 84000's command line,
never on code written in the session. Run it with the launcher in this skill,
as `reference/eft/running.md` says (it also covers Windows and the launcher's
messages):

```sh
sh "<this skill>/scripts/eft.sh" docx check-tracked <supplied.docx> <tracked.docx> --changes > "$S/check-tracked.tsv"
```

`<this skill>` is the directory this file is in, and `S` is
`84000/scratch/<toh>/copyedit/`. It compares the body, the notes, and the
headers and footers, for the revisions by "Claude", and exits 0 only when
every check passes. Each row of its output has a `check`, the `part` and
paragraph or note it is in (`where`), the `problem`, and the text around it
(`context`, with `[` `]` marking the place, `↵` a line break and `→` a tab).
Every row except a `change` row is a failure: fix the tracked file and run it
again until it exits 0. If eft cannot run, make checks 2 and 5 as described
below, and say in the review header that they were made without eft.

1. **Accept-all gives the corrected text.** Accept every revision in a copy
   (drop `w:del` elements with their content, unwrap `w:ins`, drop
   `w:rPrChange`), extract the text, and compare it with the original text with
   the change log applied. Any difference is a change missing from the log or
   a logged change entered wrongly. eft's `change` rows list every tracked
   change with its place: each must match a change-log entry, and every entry
   must have its rows. Its `accept-all` rows are line breaks, tabs or note
   references that accepting the revisions loses or moves.
2. **Reject-all gives the original, structure included.** Reject every
   revision in a copy and compare it with the supplied file paragraph by
   paragraph, keeping every run child in order (text, `w:br`, `w:tab`, note
   references, fields) and each character's run formatting, and ignoring rsid
   attributes and run segmentation. Also count `w:br` per paragraph in the
   reject-all and accept-all copies against the supplied file. A text-only
   comparison is not this check. eft's `reject-all` and `parts` rows.
3. **The validator passes** — the `docx` skill's validation script.
4. **It opens in LibreOffice and in Word.** Convert it headless
   (`soffice --headless --convert-to pdf`) and confirm the PDF renders with the
   comments present. If Word is not available to the session, say so when
   delivering; do not report a Word check that was not made.
5. **Every tracked change is minimal.** For each group of adjacent
   `w:del`/`w:ins`, the deleted and inserted text share no leading or trailing
   character beyond what the whole-word rule requires, the span never goes
   past a word boundary, and no `w:ins` stands between two parts of one
   deletion. Rebuild any change that fails. eft's `minimal` rows, with its
   `space` rows (a lost edge space) and `comments` rows (a comment inside a
   note).

## Page references

Page references are to the supplied file as rendered to PDF by LibreOffice:
convert it headless with `soffice --headless --convert-to pdf`.

## The work snapshot

When the work is held in the studio, `reference/whole-work-analysis/` shows how
to run the glossary and terminology sweeps over its draft snapshot
(`work-grep`, `work-ls`, `work-read`) and how to split a long review by chapter
across sub-agents. The snapshot is the studio's draft: if the file under review
has since been edited outside the studio, it may differ, so say which one you
checked.

When a shell is available and the work needs many passes or scripting across
files, `download-snapshot` with the `work` gives a local copy instead;
`reference/whole-work-analysis/snapshot.md` says when to choose it and how to
handle the URL, which is a credential. Without a shell, use the `work-*` tools.
