# Annotations

Annotations are ranges over a passage's `content`, carried on the
`upsert_passage` operation that creates it. Source-agnostic: what a `.docx`
style or any other source signals, it signals *as one of these*.

Every annotation has the same envelope:

```json
{ "kind": "…", "start": 0, "end": 4, "data": { … } }
```

`start` is inclusive, `end` exclusive, both character offsets into the
passage's `content`. They are not optional bookkeeping: a `link` takes its
display text from `content.slice(start, end)`, so wrong offsets mean wrong text.
An annotation covering the whole passage runs from `0` to the content length.

Multiple annotations may cover the same passage, and may overlap, when the
source independently implies each.

## The importable kinds

Only these eight can be imported. Anything else is **dropped silently** — no
error, no warning, no row.

| kind | `data` | what it marks |
|---|---|---|
| `paragraph` | — | a paragraph block |
| `blockquote` | — | quoted or set-off block |
| `indent` | — | an indented block |
| `line-group` | — | a group of verse lines |
| `line` | — | one verse line |
| `span` | `textStyle` | inline character styling |
| `link` | `href` | a hyperlink |
| `heading` | `level`, `class` | a heading |

`span.textStyle` is one of `emphasis` (italic), `text-bold`, `underline`, or
`small-caps`. Combinations are expressed as several `span` annotations over the
same range, one per style.

`link.href` is required. A link with no target cannot be represented and is
dropped, so leave the text unannotated rather than emitting an empty `href`.

`heading.level` is a **number** — `2`, not `"h2"` — and defaults to `1`.
`heading.class` defaults to `section-title`; the other values in use are
`body-title-honorific` and `body-title-main`.

## Not importable

There is no importer for `list`, `list-item`, `table`, `table-body-row`,
`table-body-data`, `abbreviation`, or `header` — note `header` in particular,
since the heading kind is `heading`. These exist as stored annotation types but
no import path builds them, so emitting one loses the content's structure
without saying so.

When a source contains a list or a table, import the text as ordinary passages,
keep the reading order, and **say so in the preview** so the editor knows the
structure did not survive. Do not emit the unsupported kinds in the hope that
something downstream understands them.
