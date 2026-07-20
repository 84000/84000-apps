This file contains worked examples for validating interpretation of the normative spec.

This file is non-normative. If an example appears to conflict with `mapping-overview.md`, `mapping-metadata.md`, `mapping-passages.md`, or `mapping-formatting.md`, the normative files win.

# Example 1: Title Page And Canonical Reference

## Input

```text
List of Titles:
1. bcom ldan 'das
2. བཅོམ་ལྡན་འདས།
3. The Blessed One

Canonical Reference:
1. Toh 44
2. Degé Kangyur, vol. 3
3. ☒ Restricted
```

## Output Rows

- create 3 rows in `titles`
- update `works.toh`
- create or update `folio_annotations.source_description`
- update `works.restriction = true`

# Example 2: Translation Section With Merged Title

## Input

```text
Heading 1: The Translation
Paragraph: Homage to all buddhas and bodhisattvas.
Paragraph: The Noble Sutra of Example
Heading 2: Chapter 1
Paragraph: Thus have I heard...
```

## Output Rows

- create 1 `passages` row with `passages.type = "translationHeader"` and `passages.label = ""`
- create 1 merged `passages` row with `passages.type = "translation"` and `passages.label = "1"`
- create 2 heading annotations on the merged passage:
  - `body-title-honorific`
  - `body-title-main`
- create 1 nested heading passage for `Chapter 1` with `passages.label = "1.1"`
- create 1 body passage with `passages.type = "translation"` and `passages.label = "1.1.1"`

# Example 3: Flat Numbering In A Non-Translation Section

## Input

```text
Heading 1: Summary
Paragraph: First summary paragraph.
Paragraph: Second summary paragraph.
```

## Output Rows

- create 1 `passages` row with `passages.type = "summaryHeader"` and `passages.label = "s."`
- create 1 body passage with `passages.type = "summary"` and `passages.label = "1"`
- create 1 body passage with `passages.type = "summary"` and `passages.label = "2"`

# Example 4: Nested Headings

## Input

```text
Heading 1: The Translation
Paragraph: Homage to all buddhas and bodhisattvas.
Paragraph: The Noble Sutra of Example
Heading 2: Chapter 1
Paragraph: Opening paragraph.
Heading 3: Section A
Paragraph: Nested paragraph.
Heading 2: Chapter 2
```

## Output Rows

- merged title passage -> `passages.label = "1"`
- `Heading 2: Chapter 1` -> `passages.label = "1.1"`
- body paragraph under `Chapter 1` -> `passages.label = "1.1.1"`
- `Heading 3: Section A` -> `passages.label = "1.1.2"`
- body paragraph under `Section A` -> `passages.label = "1.1.2.1"`
- `Heading 2: Chapter 2` -> `passages.label = "1.2"`

# Example 5: Block-Verse

## Input

```text
Paragraph style: Block-Verse
Text:
Line one⏎
Line two
```

## Output Rows

- create 1 row in `passages`
- create 1 row in `passage_annotations` with `passage_annotations.type = "blockquote"`
- create line annotations on the same passage:
  - 1 or more `line-group` annotations, depending on verse grouping
  - 1 `line` annotation for each `⏎`
