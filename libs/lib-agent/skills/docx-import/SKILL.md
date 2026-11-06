---
name: docx-import
description: Import a 84000 translation .docx file into the studio as structured passages, titles, and work metadata. Use when an editor wants to ingest a Word document that follows (however loosely) the 84000 copy-editor translation template into an empty work. Reads the docx, maps its structure to the passage schema, shows a preview for review, then writes via the studio MCP `apply-work-edits` tool.
allowed-tools: Skill(docx)
---

# Docx import

Turn a 84000 translation `.docx` into database rows: `titles`, `works`
metadata, folio source description, and `passages` (with their
`passage_annotations`).

## The mapping is guidance, not a rulebook

The 84000 copy-editor template is **loosely enforced, revised often, and the
document backlog spans many years.** Real files will deviate: reworded section
headings, missing or extra title lines, styles applied inconsistently, content
that predates the current template.

The reference files describe how a _well-formed_ document maps to the schema.
Treat them as **strong guidance you reason around**, not exact-match rules:

- Recognize a section by its _meaning_, not a literal string. "Translator's
  Introduction" is the introduction; a heading with no matching entry is still
  probably one of the known sections.
- When the document deviates, map it to the closest sensible structure and
  **note the deviation in your preview** so the editor can confirm.
- When something is genuinely ambiguous, ask the editor rather than guess
  silently. Never invent content that isn't in the source.

## Prerequisites

- The studio MCP endpoint is connected and you are authenticated as an
  **editor** (the `apply-work-edits` tool requires `editor.edit`).
- A **target work exists and has no passages yet.** Import does a first-time
  content fill and refuses a work that already has passages. Titles may already
  exist — it is common for them to be created before the content. The document
  is authoritative for titles: import **updates** the title in each existing
  slot to the document's content and **inserts** any new slots (a slot is a
  type + language, e.g. the English main title).

## Workflow

### 1. Read the docx

A `.docx` is a ZIP of OOXML. Extract the text **with its structure preserved** —
you need paragraph styles (`Heading 1`, `Verse`, `Block`, `Normal`, …), heading
levels, inline runs (bold / italic / underline / small-caps), hyperlinks, and
any lists or tables.

- If the file is attached to this conversation, read it directly.
- If you have a shell: `pandoc -t markdown file.docx` for a quick read, and
  `unzip -p file.docx word/document.xml` when you need exact styles/runs.
- Preserve soft line breaks (`⏎`) inside verse paragraphs — they drive `line`
  annotations.

### 2. Identify the target work

Use `get-translation` (by `toh` or `uuid`) to confirm the work and capture its
`workUuid`. Use `get-toc` / `get-translation-passages` to confirm it has no
passages yet. If it already has some titles, expect import to update them from
the document and add any missing ones.

### 3. Map structure → ops

Two layers, in two places. **`reference/import-model/`** says what the studio
accepts — it is shared with every other importer, so it is the same contract
however the content arrived:

- `import-model/operations.md` — the four import ops and their shapes
- `import-model/passages.md` — passage types, section families, label rules
- `import-model/annotations.md` — the eight importable annotation kinds
- `import-model/titles.md` — title slots and work metadata

The `docx-*` files say how a Word document signals those things: read
`reference/docx-structure.md` first, then `reference/docx-metadata.md`,
`reference/docx-sections.md`, or `reference/docx-styles.md` for what is in front
of you. `reference/examples.md` shows input beside the ops it should
produce — check your reading against it before building the preview.

Build an ordered list of ops in source order.

### 4. Present a preview for review (required)

Before writing, show the editor a concise summary: counts (titles, passages,
annotations, work updates), the section outline with labels, and any deviations
or assumptions you made. Back it with a dry run: call `apply-work-edits` with
`{ "workUuid": "…", "ops": [ … ], "dryRun": true }`. It plans every op against
the stored work and writes nothing; report anything it refuses or warns about,
and which titles it would update rather than insert. **Do not write until the
editor confirms.**

### 5. Apply

Call `apply-work-edits` again with the same ops and no `dryRun`. It writes the
work metadata first, then the passages through the shared passage save path,
and returns each group with what it wrote and any warnings (e.g. a missing
folio-annotation row).

If the call is refused (`success: false` with nothing applied), fix what
`error` names and call it again.

A large import is saved in chunks. If it fails partway (the `passages` group
comes back `applied: "unknown"`, or the result is lost), call it again with the
same ops: passages and annotations sent without uuids get derived ones, so the
re-run updates what the first run saved rather than duplicating it. If the
work-metadata group was already written, drop any `expect` guards from the
re-run: they hold the values that group replaced, so they would refuse it.

### 6. Verify

Confirm with `get-toc` and `get-translation-passages` that the structure and
labels landed as previewed. Report the result to the editor.

## Known limits

- **No existing passages.** The target work must have no passages; re-import /
  update of a work that already has content is not supported yet. Existing
  titles are fine: the document is authoritative, so import updates each
  existing title slot to the document's content and adds any missing slots
  (matched by type + language).
- **Bibliography and Glossary sections are skipped** (detected, no rows).
- **Internal links** are imported as ordinary links; post-ingest correction of
  internal-link targets is not automated yet — flag them for the editor.
- **Lists and tables cannot be imported as structure.** No importer exists for
  the annotation kinds that would carry them, and an unsupported kind is dropped
  without an error. Import the text in reading order and say in the preview that
  the structure was flattened. The same is true of the tab-separated pairing in
  an abbreviations section.
