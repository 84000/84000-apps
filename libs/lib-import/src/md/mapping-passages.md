This file defines passage creation and section-specific row generation.

Use `mapping-overview.md` for:

- processing order
- section state
- label generation
- precedence
- unsupported sections

# Rule Format

Each rule uses the same structure:

- `Input`: what the agent detects in the source document
- `Output rows`: which rows to create or update
- `Field assignments`: which fields to set
- `Ordering / grouping`: how rows are ordered, grouped, or merged
- `Exceptions`: special handling, if any

# Passage Generation

After `Canonical Reference:`, treat the remaining supported content as passage input.

## Base Paragraph Rule

### Required Rules

- `Input`: any supported paragraph after `Canonical Reference:`
- `Output rows`: create 1 row in `passages`, unless a more specific merge rule applies
- `Field assignments`: set `passages.content` to the normalized paragraph text
- `Ordering / grouping`: emit in source order
- `Exceptions`: none

## Notes

- A hard return `¶` usually starts a new `passages` row.
- A soft return `⏎` never creates a new `passages` row by itself.

## Header Derivation

### Required Rules

- `Input`: a paragraph with style `Heading 1`
- `Output rows`: create 1 row in `passages`
- `Field assignments`: set `passages.content` to the heading text
- `Ordering / grouping`: this row starts a new top-level section
- `Exceptions`: section-specific labels and types are defined later in this document

- `Input`: a paragraph with style `Heading 2` or deeper
- `Output rows`: create 1 row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - set `passages.content` to the heading text
  - set `passages.label` according to the document outline position
  - set `passages.type` to the active section header type
  - set `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - set `passage_annotations.type = "header"`
- `Ordering / grouping`: nested headings remain inside the active section
- `Exceptions`: if the actual heading depth is deeper than `h2`, preserve the real heading level in `passage_annotations.content`

- `Input`: a document with endnotes
- `Output rows`: create 1 header row in `passages` for the endnotes section
- `Field assignments`:
  - set `passages.label = "n."`
  - set `passages.type = "endnotesHeader"`
  - set `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - set `passage_annotations.type = "heading"`

### Exceptions

- MS Word supports heading levels up to `Heading 9`.
- If editors use typed tags such as `<level 10 div>`, treat them as deeper nested headings in the current section.

## Notes

For `Heading 1`, derive the base section family by removing a leading `The` and converting the result to lowercase. For example, `The Translation` becomes `translation`.

## Notes

If a passage is a header, append `Header` to the section family. For example, `translationHeader`.

# Section Rules

## Summary

### Required Rules

- `Input`: `Heading 1` with text `Summary`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = "s."`
  - `passages.type = "summaryHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: following paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "summary"`

## Acknowledgements

### Required Rules

- `Input`: `Heading 1` with text `Acknowledgements`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = "ac."`
  - `passages.type = "acknowledgementHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: following paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "acknowledgement"`

## Preface

### Required Rules

- `Input`: `Heading 1` with text `Preface`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = "pr."`
  - `passages.type = "prefaceHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: following paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "preface"`

## Introduction

### Required Rules

- `Input`: `Heading 1` with text `Introduction`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = "i."`
  - `passages.type = "introductionHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: following paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "introduction"`

## The Translation

### Required Rules

- `Input`: `Heading 1` with text `The Translation`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = ""`
  - `passages.type = "translationHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: if present, the next two paragraphs are the honorific and main title
- `Output rows`: create 1 merged row in `passages` and 2 rows in `passage_annotations`
- `Field assignments`:
  - `passages.label = "1"`
  - `passages.type = "translation"`
  - create `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"body-title-honorific"}]'`, `passage_annotations.type = "heading"`
  - create `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"body-title-main"}]'`, `passage_annotations.type = "heading"`
- `Ordering / grouping`: merge the two source paragraphs into one `passages` row, preserving source order within `passages.content`

- `Input`: all remaining paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "translation"`

## Colophon

### Required Rules

- `Input`: `Heading 1` with text `Colophon`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = "c."`
  - `passages.type = "colophonHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: following paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "colophon"`

## Endnotes

### Required Rules

- `Input`: note paragraphs
- `Output rows`: create 1 row in `passages` per note
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "endnotes"`

## Abbreviations

### Required Rules

- `Input`: content in the `Abbreviations` section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "abbreviations"`

- `Input`: tab-separated abbreviation entries such as `C    Chone Kangyur`
- `Output rows`: create abbreviation annotations on the containing passage
- `Field assignments`:
  - `passage_annotations.content = '[{"uuid":"{passage_uuid}","abbreviation_xmlId":"{textXmlId}/abbreviation"}]'`
  - `passage_annotations.type = "abbreviation"`
  - set annotation offsets such as `start` and `end` relative to `passages.content`

## Appendix

### Required Rules

- `Input`: `Heading 1` with text `Appendix`
- `Output rows`: create 1 header row in `passages` and 1 row in `passage_annotations`
- `Field assignments`:
  - `passages.label = "ap."`
  - `passages.type = "appendixHeader"`
  - `passage_annotations.content = '[{"heading-level":"h2"},{"heading-type":"section-title"}]'`
  - `passage_annotations.type = "heading"`

- `Input`: following paragraphs until the next top-level section
- `Output rows`: create 1 row in `passages` per paragraph unless another rule applies
- `Field assignments`:
  - set `passages.label` using the hierarchical label rules
  - `passages.type = "appendix"`

# Deferred / Out Of Scope

## Bibliography

- `Input`: `Heading 1` with text `Bibliography`
- `Output rows`: none for this importer
- `Field assignments`: none
- `Ordering / grouping`: detect the section boundary and skip all content until the next supported `Heading 1` or the end of the document

## Glossary

- `Input`: `Heading 1` with text `Glossary`
- `Output rows`: none for this importer
- `Field assignments`: none
- `Ordering / grouping`: detect the section boundary and skip all content until the next supported `Heading 1` or the end of the document
