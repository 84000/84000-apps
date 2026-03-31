This file defines metadata rules for `.docx` content that appears before passage generation begins.

# Rule Format

Each rule uses the same structure:

- `Input`: what the agent detects in the source document
- `Output rows`: which rows to create or update
- `Field assignments`: which fields to set
- `Ordering / grouping`: how rows are ordered or grouped
- `Exceptions`: special handling, if any

# Cover Sheet

## Required Rules

- `Input`: the first one or two pages are cover-sheet content
- `Output rows`: none
- `Field assignments`: none
- `Ordering / grouping`: skip all cover-sheet paragraphs
- `Exceptions`: none

## Notes

This information is usually already in the database.

# Title Page

After the cover sheet, process the title page metadata.

## List of Titles

### Required Rules

The lines in `List of Titles:` appear in a fixed order.

- `Input`: `¶ 1` Main Title Tibetan Wylie
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "mainTitle"`, `titles.language = "Bo-Ltn"`
- `Input`: `¶ 2` Main Title Tibetan
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "mainTitle"`, `titles.language = "bo"`
- `Input`: `¶ 3` Main Title English
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "mainTitle"`, `titles.language = "en"`
- `Input`: `¶ 4` Main Title Sanskrit
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "mainTitle"`, `titles.language = "Sa-Ltn"`
- `Input`: `¶ 5` Long Title Tibetan
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "longTitle"`, `titles.language = "bo"`
- `Input`: `¶ 6` Long Title Tibetan Wylie
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "longTitle"`, `titles.language = "Bo-Ltn"`
- `Input`: `¶ 7` Long Title English
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "longTitle"`, `titles.language = "en"`
- `Input`: `¶ 8` Long Title Sanskrit
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "longTitle"`, `titles.language = "Sa-Ltn"`
- `Input`: `¶ 9` Chinese Title
  `Output rows`: create 1 row in `titles`
  `Field assignments`: `titles.content`, `titles.type = "longTitle"`, `titles.language = "zh"`

### Ordering / Grouping

- Preserve source order.
- If a title line is missing, emit no row for that slot.

## Additional Titles

### Required Rules

- `Input`: any line under `Additional Titles:`
- `Output rows`: create 1 row in `titles` per line
- `Field assignments`: `titles.content`, `titles.type = "otherTitle"`
- `Ordering / grouping`: preserve source order
- `Exceptions`: none

## Canonical Reference

### Required Rules

- `Input`: `¶ 1` Toh
  `Output rows`: update the current work
  `Field assignments`: `works.toh = "toh{number}"`
- `Input`: `¶ 2` source description
  `Output rows`: create or update metadata row(s)
  `Field assignments`: set `folio_annotations.source_description`
- `Input`: `¶ 3` tantra warning
  `Output rows`: update the current work if the source string contains `☒`
  `Field assignments`: `works.restriction = true`

### Notes

The source description string may also be used to populate additional columns, but only `folio_annotations.source_description` is required by this spec.
