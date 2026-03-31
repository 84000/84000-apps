This file defines the global rules for mapping the current [copy editor template, version 23.1](https://drive.google.com/file/d/1jAaza-WFHmtQsSGIxYvRQtP22YVCMpuk/view?usp=sharing) to database rows.

The mappings are based on [the sample text](https://docs.google.com/document/d/1-frC21K5AGGIsk3Gv_KEDQ23YUPj3iXT/edit?usp=sharing&ouid=108496186515648739610&rtpof=true&sd=true), which can be used to test the transformation.

# Purpose

An agent should be able to convert a `.docx` file into database rows using this spec set without making product or schema decisions.

This file is the canonical source for:

- processing order
- section state
- label generation
- precedence
- fallback behavior
- unsupported section handling

# How To Read This Spec Set

Use this file first.

Then classify the current source input:

- metadata -> read `mapping-metadata.md`
- passage structure -> read `mapping-passages.md`
- formatting or annotations -> read `mapping-formatting.md`

Use `mapping-examples.md` only to validate interpretation. It is non-normative.

If a specialized file appears to conflict with this file, this file wins unless it explicitly delegates that behavior.

# Vocabulary

- `paragraph`: a Word paragraph
- `hard return`: a paragraph break, shown here as `¶`
- `soft return`: a line break within a paragraph, shown here as `⏎`
- `adjacent paragraphs`: consecutive paragraphs with no paragraph of another style between them
- `section`: a top-level content area started by a `Heading 1`
- `header passage`: a row in `passages` whose `passages.type` ends with `Header`
- `merged passage`: one `passages` row created from multiple source paragraphs
- `label path`: the numeric hierarchy assigned to non-header passages within a top-level section

# Output Conventions

- Use backticks for all schema references such as `titles.content`, `works.toh`, and `passage_annotations.type`.
- When `passage_annotations.content` stores JSON, serialize it exactly as shown in this spec set.
- If a field is not mentioned in a rule, leave it unchanged or unset.
- Rows must be emitted in source order unless a rule explicitly says otherwise.
- Use placeholders consistently:
  - `{number}`
  - `{passage_uuid}`
  - `{textXmlId}`
  - `{INTEGER_COUNT}`
  - `{EXTERNAL_URL}`

# Processing Order

Process the document in this order:

1. Ignore the cover sheet.
2. Read the title page.
3. Read the `Canonical Reference:` section.
4. Enter passage generation mode.
5. Track the active section from `Heading 1`.
6. Track nested headings from `Heading 2` and deeper.
7. Emit rows in source order.
8. Skip explicitly unsupported sections.

# Active Section State

- A `Heading 1` starts a new top-level section.
- The active section remains in effect until the next `Heading 1` or the end of the document.
- A `Heading 2` or deeper heading creates a nested heading passage within the active section.
- Nested headings inherit the active section family for `passages.type`.
- Unsupported top-level sections must still be detected so the importer knows where supported content resumes.

# Fallback Behavior

- Unknown paragraph styles fall back to `Normal`.
- Unknown inline formatting is ignored unless explicitly mapped in this spec set.
- Unsupported sections are detected and skipped, not partially ingested.

# Precedence Rules

When multiple signals apply to the same source content, use this precedence:

1. Paragraph style determines whether a `passages` row is created and sets the base `passages.type`.
2. Section context determines section-specific labels and header types.
3. Block, verse, mantra, list, and table semantics add `passage_annotations` rows to the passage created by the paragraph rule.
4. Inline formatting adds `passage_annotations` rows and never changes the base `passages.type`.

Multiple annotations of different types may coexist on the same passage if each is independently implied by the source formatting.

# Label Rules

Generate labels according to the active section family.

## Required Rules

- Fixed top-level section header labels:
  - `Summary` header -> `passages.label = "s."`
  - `Acknowledgements` header -> `passages.label = "ac."`
  - `Preface` header -> `passages.label = "pr."`
  - `Introduction` header -> `passages.label = "i."`
  - `The Translation` header -> `passages.label = ""`
  - `Colophon` header -> `passages.label = "c."`
  - `Endnotes` header -> `passages.label = "n."`
  - `Appendix` header -> `passages.label = "ap."`
- All non-header passages in supported sections use hierarchical numeric labels.
- Each supported top-level section maintains its own numbering tree.
- Numbering resets when a new supported top-level section begins.
- The first non-header passage in a section is labeled `1`.
- A heading consumes the next number in the current scope.
- A body passage under the current scope consumes the next child number beneath that scope.
- Heading depth maps directly to label depth:
  - first body passage in a section with no nested heading -> `1`
  - next body passage in that same scope -> `2`
  - first `Heading 2` after section content `1` -> `1.1`
  - first body passage under `1.1` -> `1.1.1`
  - next sibling `Heading 2` under section content `1` -> `1.2`
  - first `Heading 3` under `1.2` -> `1.2.1`
  - first body passage under `1.2.1` -> `1.2.1.1`
- Skipped sections such as `Bibliography` and `Glossary` do not consume label numbers.

## Notes

Use the current section's numbering tree when assigning labels to nested headings and ordinary body passages. Section headers themselves are not part of the numeric tree.

# Unsupported Sections

The following top-level sections are out of scope for this importer:

- `Bibliography`
- `Glossary`

When one of these sections is encountered:

- detect the `Heading 1`
- emit no rows for that section
- resume processing at the next supported `Heading 1` or the end of the document
