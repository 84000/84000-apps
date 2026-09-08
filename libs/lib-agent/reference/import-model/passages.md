# Passages: types and labels

How 84000 content is shaped once it reaches the studio, independent of the file
it arrived in. A source reader's job is to decide which section it is in and
which paragraphs are headers; the types and labels below follow from that.

## Section families

Each top-level section has a family. A header passage takes the family plus
`Header`; body passages take the family alone.

| section | header type | body type | header label |
|---|---|---|---|
| Summary | `summaryHeader` | `summary` | `s.` |
| Acknowledgements | `acknowledgementHeader` | `acknowledgement` | `ac.` |
| Preface | `prefaceHeader` | `preface` | `pr.` |
| Introduction | `introductionHeader` | `introduction` | `i.` |
| The Translation | `translationHeader` | `translation` | `""` |
| Colophon | `colophonHeader` | `colophon` | `c.` |
| Endnotes | `endnotesHeader` | `endnotes` | `n.` |
| Appendix | `appendixHeader` | `appendix` | `ap.` |
| Abbreviations | — | `abbreviations` | — |

The family is the section name lowercased with a leading `The` removed, so
`The Translation` gives `translation` and `translationHeader`.

Every section header carries a `heading` annotation with `level: 2` and
`class: "section-title"`.

## Nested headings

A heading below the top level is a passage of the **active section's header
type**, labelled by its position in the outline, and carrying a `heading`
annotation with its real depth in `level` and `class: "section-title"`. Depth is
not capped at 2 — preserve the actual level.

## The translation body title

Where a translation section opens with an honorific line and a main title line,
they merge into **one** passage — label `1`, type `translation`, source order
preserved within the content — carrying two `heading` annotations over their
respective ranges: `class: "body-title-honorific"` and `class: "body-title-main"`,
both at `level: 2`.

## Labels

Section headers take the fixed label in the table above. Everything else is
numbered.

- Each supported top-level section keeps **its own numbering tree**, reset when
  the section begins.
- Section headers are not part of the tree.
- The first non-header passage in a section is `1`.
- A heading consumes the next number in the current scope; a body passage
  consumes the next child number beneath the current scope.
- Heading depth maps directly to label depth.

Worked through, in one section:

| position | label |
|---|---|
| first body passage, no nested heading yet | `1` |
| next body passage, same scope | `2` |
| first nested heading after body `1` | `1.1` |
| first body passage under it | `1.1.1` |
| next sibling heading under body `1` | `1.2` |
| first deeper heading under `1.2` | `1.2.1` |
| first body passage under that | `1.2.1.1` |

Sections that are skipped rather than imported consume no numbers.

## Out of scope

`Bibliography` and `Glossary` are detected so the reader knows where supported
content resumes, and produce no passages. They are skipped whole, never
partially ingested.
