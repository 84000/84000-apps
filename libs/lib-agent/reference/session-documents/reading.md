# Reading documents an earlier stage saved

A stage that depends on an earlier one reads that stage's record out of the
`translation-sessions` bucket, not off local disk. The earlier stage may have
run weeks ago, in another session, on another machine, or for someone else, so a
local file is not evidence of anything and its absence is not evidence either.

This file is the mechanism. Which document a stage depends on, and what to do
when it is not there, is in that stage's own spec.

## The call

Call `read-session-documents` with:

| | |
|---|---|
| `toh` | the work's Toh number, e.g. `toh345` |
| `stage` | the stage whose documents you want. Omit it to cover every stage of the work |
| `names` | the filenames to read, e.g. `["toh345_stage0.md"]`. Requires `stage`. Omit to list what is saved without reading it |

Markdown and JSON come back inline as text. A `.docx` comes back as a signed
download URL for you to fetch — an editor's Word document is of no use to a
model as bytes, so nothing tries to inline it.

Calling with just the `toh` lists everything saved for the work, across stages.
That is how to discover what an earlier stage actually produced, rather than
assuming it produced the minimum: a collation report, a supplementary record.
Each stage's `manifest.json` is readable the same way and says who saved that
stage's files, when, and with what model.

## Absent is not unreadable

The two come back as different errors, and the difference decides what to do:

- **No document matched** — nothing has been saved under that name. The stage
  you depend on has not run, or did not save. Follow your own spec: usually stop
  and say which stage is missing.
- **Could not read** — the document may well exist and storage failed to hand it
  over. Stop and report that. It is a transient condition, not a missing record.

**Never treat a failed read as an absent document.** A stage told its
predecessor produced nothing will start over and re-derive work that is sitting
in storage — which loses the earlier stage's judgment calls, and silently.
