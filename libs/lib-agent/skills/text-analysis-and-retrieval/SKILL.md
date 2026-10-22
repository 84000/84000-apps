---
name: text-analysis-and-retrieval
description: Run Stage 0 of the 84000 AI translation pipeline for a canonical Tibetan work — retrieve the Degé source by Toh number, register the work against the Toh catalog, and assemble the report a translator needs before drafting (catalog record, structural map, major themes, precedent translations, Kangyur and Tengyur resources, open questions), saved as toh#_stage0.md. Use when a translator or editor asks to analyze, scope, research, or prepare a text by Toh number before drafting begins, or names Stage 0 of the pipeline, or asks which recensions, related works or commentaries bear on a work. Not for producing a translation — that is Stage 1, the first-draft-translation skill — not for editorial review of an existing draft, which is Stage 2, the editorial-review skill, and not for collating witnesses, which is its own skill.
allowed-tools: Skill(docx)
---

# 84000 text analysis and retrieval (Stage 0)

You are producing the Stage 0 report for a text before any drafting begins,
from its Toh number alone.

## The standard is in the policies

What Stage 0 records — its principles, the report's sections and their
wording, house style, working order — is set by studio policies, not by this
skill, so the research editor can revise it without a plugin release.

At the start of every session, read **`text-analysis-and-retrieval/workflow`**
with `read-policies`, then every policy it names, and follow them. They are
edited in place, so the current text binds, not a remembered one. Call
`read-policies` with no arguments to see what else is available.

- If `read-policies` is unavailable, or a policy the workflow names cannot be
  read, stop and say so. Do not run Stage 0 from memory of an earlier version.
- Retry a policy that `read-policies` reports as `failed` before treating it
  as unreadable: a failed read is not a missing policy.
- Where a policy and this skill seem to disagree, follow the policy and report
  the conflict.

> This skill is version-pinned: it ships with the `84000-translator-tools`
> plugin and cannot change mid-session. The policies it cites are not pinned.

## What the session needs

Confirm each of these at the start of the session:

- [ ] `read-policies`, for the policies above
- [ ] The `tibetan-source-text` skill and the 84000 Studio catalog tools
      (`resolve-toh`, `get-translation`, `get-work-titles`, `get-imprint`,
      `get-translation-folios`, `search-entities`, `search-canon-sections`)
- [ ] The `kangyur-tengyur-recensions` skill, with `download-snapshot` and a
      shell. It reads the eText collections of the Kangyur, Tengyur and
      Nyingma Gyubum and their work catalog; the catalog's README lists the
      collections in the current build. Stage 0 depends on it for recensions
      and for title search over the Kangyur and Tengyur, and for the search of
      the Degé Tengyur folio text for works citing the base text. If it is not
      available in the session, the subsections that need it are reported as
      not run — see `shared-policies/canonical-resources`
- [ ] A web search tool, for precedent translations outside of 84000 content. If
      none is available, that route is reported as not run
- [ ] `read-session-documents` and `write-session-documents`, for checking
      what the work already has saved and for saving the report. See _Storage_
      below
- [ ] The `docx` skill, for the Word mirror. This is Claude's general document
      skill, not one this plugin ships

## Retrieval and the catalog

- Resolve the Toh number first with `resolve-toh`. A cited number is often not
  an entry of its own: it may be superseded, one of several a single entry
  covers, or a subdivided or lettered entry. Pass the resolved number onward;
  `resolve-toh` also reports the work's placements.
- Fetch the Degé text — Kangyur or Tengyur, Uchen Unicode — for the resolved
  number with the `tibetan-source-text` skill.
- Take the canonical section from `get-translation` and the titles from
  `get-work-titles`.

## The structural sweep

Find the closing formulas and speech formulas for the Structural Map with
`scripts/eft.mjs structure` in this skill, never with code written
in the session: the same text then always gives the same map, and a long text
takes seconds. `shared-policies/analytics` decides what goes on the map; the
script only finds the formulas. Run it with node:

```sh
node "<this skill>/scripts/eft.mjs" structure <text> > "$S/structure.tsv"
```

`<this skill>` is the directory this file is in, and `S` is
`84000/scratch/<toh>/structure/`. `<text>` is the work's Degé text as
`[F.12.a] …` lines, one folio side each: the directory of a download of the
work's Degé folios (`<toh>-vol<NNN>.txt` files), or a file written by the
`kangyur-tengyur-recensions` skill's `extract` command from the Degé eText
collection (`kangyur/D` or `tengyur/D`). If neither can be had, build the map
by reading, and say in the section's scope line that the sweep was not run.

The output is a table, one row per formula in text order (`--json` for JSON
lines):

- `kind`: `division` (a label from the patterns, then an ordinal or _rdzogs
  so_, then the closing shad); `ordinal` (the same shape after a word that is
  not a known label: check it, since most are enumerations, but some are
  divisions under a label the patterns lack); `end` (_rdzogs so_ with no
  label, as in the final title); `speech` (_gsol pa_, _bka’ stsal pa_ and the
  like).
- `label` and `number`: the division label and the ordinal's value; for
  speech, the formula. A `division` row with no number closed with _rdzogs so_
  and no ordinal: it is not a map entry unless `shared-policies/analytics`
  says otherwise, but check whether the text numbers that division elsewhere.
- `level`: nesting, 0 outermost, inferred from how often each label (with
  the forms that continue its count) closes.
  Check it against the text where labels nest.
- `from`, `at`, `to`: where the division begins (the side after the previous
  closing at its level or above; for the first, the start of the text, so
  move it to the division's first words), where the statement holding the
  formula begins, and where it ends. In a work of several volumes a folio in
  another volume is prefixed with its file. A single file that runs over
  several volumes repeats folio numbers, so `from` and `at` name the folio
  but not its volume: give the work as a directory of volume files instead.
- `note`: a skipped, repeated or restarted ordinal, or one that starts above
  1, and a label that takes up another's count in a new form (_brtag pa’i
  rgyal po_ 4, then _brtag pa_ 5). These are irregularities the map records,
  not errors to reconcile. Numbering under a division counts afresh when the
  division above it closes, so a restart there gets no note.
- `text`: the statement in EWTS (house profile, closing shad kept), from the
  previous double shad to the formula's end; for a division, its title in
  full. `tibetan` is the same in Unicode, to check the EWTS against.

Speech rows are for the Interlocutors and, in a text without divisions, the
inferred entries; they are not map entries. The patterns (labels, ordinal
spellings, speech formulas) are built in: `structure --print-patterns`
prints them. When a text closes its divisions with a label or spelling they
lack, copy them to `$S/patterns.json`, add it, rerun with
`--patterns "$S/patterns.json"`, and name the addition in the scope line.

## Storage

Read and save through the studio, not local disk: Stage 1 and Stage 2 read the
report from storage, in other sessions and on other machines.
`reference/session-documents/reading.md` and `saving.md` are the mechanism:
the calls, the upload URLs and the PUT that carries the bytes, what happens on
a re-run, and what to do when the client cannot make an outbound request. Read
`saving.md` before the first save of a session.

**Local files.** Write `toh#_stage0.md` and its Word mirror to
`84000/deliverables/<toh>/`, and downloads and working files where
`reference/local-files/layout.md` puts them.

**An existing record.** Before running, check with `read-session-documents`
whether a `toh#_stage0.md` is already saved for this work, and apply the
workflow's rule for a re-run.

**Saving.** Save the deliverables once the local files are written and
complete, with `write-session-documents`, passing the work's `toh`,
`stage: stage0`, `toh#_stage0.md` as `primary` and `toh#_stage0.docx` as
`supporting`, and your `model`, then PUT each file to the upload URL it
returns. Without this the record is only on one machine, and Stage 1 has
nothing to read. The save is not complete until every PUT has succeeded: do
not report the stage as saved when an upload failed or the client could not
make the PUT.
