This file defines formatting and annotation rules.

Use `mapping-overview.md` for:

- section state
- label generation
- precedence
- fallback behavior

Use `mapping-passages.md` for creation of the containing `passages` row.

# Rule Format

Each rule uses the same structure:

- `Input`: what the agent detects in the source document
- `Output rows`: which rows to create or update
- `Field assignments`: which fields to set
- `Ordering / grouping`: how rows are ordered, grouped, or merged
- `Exceptions`: special handling, if any

# Paragraph Styles

## Verse

### Required Rules

- `Input`: adjacent paragraphs with style `Verse`
- `Output rows`: create 1 row in `passages` per paragraph and create line annotations for that passage
- `Field assignments`:
  - set `passages.content`
  - for each `¶` boundary in verse grouping, create `passage_annotations.content = "[]"`, `passage_annotations.type = "line-group"`
  - for each `⏎` in the verse paragraph, create `passage_annotations.content = "[]"`, `passage_annotations.type = "line"`
- `Ordering / grouping`: preserve source order; annotations belong to the passage created from the current verse paragraph
- `Exceptions`: none

## Block

### Required Rules

- `Input`: a paragraph with style `Block`
- `Output rows`: create 1 row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - set `passages.content`
  - set `passage_annotations.content = "[]"`
  - set `passage_annotations.type = "blockquote"`

## Block-Verse

### Required Rules

- `Input`: a paragraph with style `Block-Verse`
- `Output rows`: create 1 row in `passages` and multiple rows in `passage_annotations`
- `Field assignments`:
  - set `passages.content`
  - create `passage_annotations.type = "line-group"` rows from verse grouping
  - create `passage_annotations.type = "line"` rows from each `⏎`
  - create 1 `passage_annotations.type = "blockquote"` row with `passage_annotations.content = "[]"`
- `Ordering / grouping`: all annotations belong to the same passage

## Mantra-Block

### Required Rules

- `Input`: a paragraph with style `Mantra-Block`
- `Output rows`: create 1 row in `passages` and 2 rows in `passage_annotations`
- `Field assignments`:
  - set `passages.content`
  - create `passage_annotations.content = "[]"`, `passage_annotations.type = "paragraph"`
  - create `passage_annotations.content = "[]"`, `passage_annotations.type = "indent"`

## Mantra-Block-Verse

### Required Rules

- `Input`: a paragraph with style `Mantra-Block-Verse`
- `Output rows`: create 1 row in `passages` and multiple rows in `passage_annotations`
- `Field assignments`:
  - set `passages.content`
  - create `passage_annotations.type = "line-group"` rows from verse grouping
  - create `passage_annotations.type = "line"` rows from each `⏎`
  - create 1 `passage_annotations.content = "[]"`, `passage_annotations.type = "indent"` row
- `Ordering / grouping`: do not create a `paragraph` annotation for this style

## Trailer

### Required Rules

- `Input`: a paragraph with style `Trailer`
- `Output rows`: create 1 row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - set `passages.content`
  - set `passage_annotations.content = "[]"`
  - set `passage_annotations.type = "blockquote"`

## Normal And Unknown Styles

### Required Rules

- `Input`: a paragraph with style `Normal`
- `Output rows`: create 1 row in `passages`
- `Field assignments`: set `passages.content`
- `Ordering / grouping`: no additional annotations unless another rule applies

- `Input`: a paragraph with an unknown style
- `Output rows`: treat the paragraph exactly as `Normal`

# Lists

## Required Rules

- `Input`: a paragraph or paragraph group using native MS Word list formatting
- `Output rows`: create the base `passages` row and create list-related `passage_annotations` rows
- `Field assignments`:
  - main list annotation:
    `passage_annotations.content = '[{"list-spacing":"horizontal"},{"list-item-style":"dots|letters|numbers"}]'`
    `passage_annotations.type = "list"`
  - list item annotation:
    `passage_annotations.content = "[]"`
    `passage_annotations.type = "list-item"`
- `Ordering / grouping`: list annotations belong to the passage created from the current paragraph

## Exceptions

- Convert native bullet lists to `dots`
- Convert native letter lists to `letters`
- Convert native number lists to `numbers`
- For nested lists, add `{"nesting": 1}` to `passage_annotations.content`

# Tables

## Required Rules

- `Input`: a native MS Word table
- `Output rows`: create table annotations under the relevant passage context
- `Field assignments`:
  - full table -> `passage_annotations.content = "[]"`, `passage_annotations.type = "table"`
  - table row -> `passage_annotations.content = "[]"`, `passage_annotations.type = "table-body-row"`
  - table cell -> `passage_annotations.content = "[]"`, `passage_annotations.type = "table-body-data"`
- `Ordering / grouping`: preserve table row and cell order exactly as in the source

# Character Formatting

These rules add annotations to the passage already produced by the paragraph rule.

## Required Rules

- `Input`: italic text
  `Output rows`: create 1 row in `passage_annotations`
  `Field assignments`:
  - `passage_annotations.content = '[{"text-style":"emphasis"}]'`
  - `passage_annotations.type = "span"`
- `Input`: bold text
  `Output rows`: create 1 row in `passage_annotations`
  `Field assignments`:
  - `passage_annotations.content = '[{"text-style":"text-bold"}]'`
  - `passage_annotations.type = "span"`
- `Input`: underlined text
  `Output rows`: create 1 row in `passage_annotations`
  `Field assignments`:
  - `passage_annotations.content = '[{"text-style":"underline"}]'`
  - `passage_annotations.type = "span"`
- `Input`: small caps text
  `Output rows`: create 1 row in `passage_annotations`
  `Field assignments`:
  - `passage_annotations.content = '[{"text-style":"small-caps"}]'`
  - `passage_annotations.type = "span"`
- `Input`: external link
  `Output rows`: create 1 row in `passage_annotations`
  `Field assignments`:
  - `passage_annotations.content = '[{"href":"{EXTERNAL_URL}"}]'`
  - `passage_annotations.type = "link"`
- `Input`: internal link
  `Output rows`: create 1 row in `passage_annotations`
  `Field assignments`:
  - use the same link format as external links during ingest
- `Ordering / grouping`: inline annotations are attached to the containing passage and preserve source order

## Notes

- Any combination of italic, bold, and underline may occur and should be preserved.
- Internal links are post-corrected after ingestion because the target passage UUID does not exist until passages are imported.
