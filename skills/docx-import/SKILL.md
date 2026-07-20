---
name: docx-import
description: Import a legacy 84000 translation .docx file into the studio as structured passages, titles, and work metadata. Use when an editor wants to ingest a Word document that follows (however loosely) the 84000 copy-editor translation template into an empty work. Reads the docx, maps its structure to the passage schema, shows a preview for review, then writes via the studio MCP `apply-docx-import` tool.
---

# Docx import

Turn a legacy 84000 translation `.docx` into database rows: `titles`, `works`
metadata, folio source description, and `passages` (with their
`passage_annotations`).

## The mapping is guidance, not a rulebook

The 84000 copy-editor template is **loosely enforced, revised often, and the
document backlog spans many years.** Real files will deviate: reworded section
headings, missing or extra title lines, styles applied inconsistently, content
that predates the current template.

The reference files describe how a *well-formed* document maps to the schema.
Treat them as **strong guidance you reason around**, not exact-match rules:

- Recognize a section by its *meaning*, not a literal string. "Translator's
  Introduction" is the introduction; a heading with no matching entry is still
  probably one of the known sections.
- When the document deviates, map it to the closest sensible structure and
  **note the deviation in your preview** so the editor can confirm.
- When something is genuinely ambiguous, ask the editor rather than guess
  silently. Never invent content that isn't in the source.

## Prerequisites

- The studio MCP endpoint is connected and you are authenticated as an
  **editor** (the `apply-docx-import` tool requires `editor.edit`).
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

### 3. Map structure → operations

Read `reference/mapping-overview.md` first, then the specialized file for the
content in front of you (`reference/mapping-metadata.md`,
`reference/mapping-passages.md`, `reference/mapping-formatting.md`). Use
`reference/mapping-examples.md` to sanity-check your interpretation.

Build an ordered list of **operations** (the input to `apply-docx-import`):

- `update_work` — `{ "kind": "update_work", "patch": { "toh": "toh44" } }`
  (also `{ "restriction": true }` when the tantra warning `☒` is present).
- `insert_title` —
  `{ "kind": "insert_title", "title": { "content": "…", "type": "mainTitle", "language": "bo" } }`.
  Types: `mainTitle`, `longTitle`, `otherTitle`. Languages: `bo`, `Bo-Ltn`,
  `en`, `Sa-Ltn`, `zh`.
- `upsert_folio_annotation` —
  `{ "kind": "upsert_folio_annotation", "patch": { "source_description": "…" } }`.
- `insert_passage` —
  `{ "kind": "insert_passage", "passage": { "label": "1.1", "type": "translation", "content": "…" }, "annotations": [ … ] }`.
  Each annotation is `{ "kind": "span", "start": 0, "end": 4, "data": { "textStyle": "emphasis" } }`.
  Annotation kinds: `blockquote`, `paragraph`, `indent`, `line-group`, `line`,
  `span` (`data.textStyle`: `text-bold` | `emphasis` | `underline` |
  `small-caps`), `link` (`data.href`), `heading` (`data.level`, `data.class`).

You do **not** need to supply UUIDs, `sort`, `xmlId`, or per-row `workUuid` —
the write tool fills those in. Emit operations in source order.

### 4. Present a preview for review (required)

Before writing, show the editor a concise summary: counts (titles, passages,
annotations, work updates), the section outline with labels, and any deviations
or assumptions you made. **Do not call the write tool until the editor
confirms.** This conversational preview is the dry-run gate.

### 5. Apply

Call `apply-docx-import` with `{ "workUuid": "…", "operations": [ … ] }`. It
writes everything to the empty work through the shared passage save path and
returns counts plus any warnings (e.g. a missing folio-annotation row).

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
- Tables and native lists are described in the formatting reference but are
  easy to get wrong from a rough extraction — preview them carefully.
