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

Anything else is **dropped silently** — no error, no warning, no row.

These eight are what a document mapping produces:

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

These seven exist for a different reason — a pass that edits a passage which
already has content must send that passage's **whole** annotation set back, and
anything it cannot express here is deleted as absent. A document mapping has no
reason to emit them:

| kind | `data` | what it marks |
|---|---|---|
| `mention` | `entity`, `linkType`, and see below | a link to another entity |
| `glossary-instance` | `glossary`, `authority` | an attested glossary term |
| `end-note-link` | `endNote`, `label` | an end-note marker |
| `inline-title` | `lang` | a title inside running text |
| `mantra` | `lang` | a mantra |
| `trailer` | — | a trailer |
| `leading-space` | — | a leading space |

`mention.entity` is the target's uuid and `mention.linkType` says what kind of
thing it is (`folio`, `passage`, `work`, `bibliography`, `glossary`); both are
required. It also takes `isSameWork`, `subtype`, `text`, `lang`,
`style: "quote"`, and `highlightStart` / `highlightEnd` — a range in the
*target*, not in this passage.

`mention.linkToh` is the **target's** Tohoku number. It is a different field
from the annotation's own `toh`, which scopes visibility; do not conflate them.

A mention is zero-length: `start` and `end` are equal, at the position it marks.

`glossary-instance` needs both `glossary` and `authority` — one alone cannot be
resolved. `end-note-link` needs `endNote`; its `label` is optional.
`inline-title` needs `lang`. A kind missing what it requires is dropped like any
other unrepresentable annotation.

## Preserving an existing annotation

An annotation operation may carry a `uuid`. Omit it on a first import and one is
derived. Send the stored uuid when rewriting a passage that already has
annotations, so the row is updated rather than deleted and replaced — other rows
reference annotations by uuid.

## Not importable

There is no importer for `list`, `list-item`, `table`, `table-body-row`,
`table-body-header`, `table-body-data`, `abbreviation`, `has-abbreviation`,
`internal-link`, `image`, `audio`, `code`, `comment`, or `header` — note
`header` in particular, since the heading kind is `heading`. These exist as
stored annotation types but no import path builds them, so emitting one loses
the content's structure without saying so.

The `deprecated-*` types stored in the database (`deprecated-reference`,
`deprecated-quoted`, `deprecated-temp-mention`, `deprecated-internal-link`) have
no import path either, and unlike the list above they have no domain type to
round-trip through — a read maps them to `unknown`. A pass over a passage
carrying one cannot preserve it.

When a source contains a list or a table, import the text as ordinary passages,
keep the reading order, and **say so in the preview** so the editor knows the
structure did not survive. Do not emit the unsupported kinds in the hope that
something downstream understands them.
