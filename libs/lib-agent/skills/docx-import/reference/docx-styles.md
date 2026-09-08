# Styles and inline formatting

Which Word styles and runs produce which annotations. The annotation envelope,
the `data` shapes, and what is importable at all are in
`import-model/annotations.md`.

Annotations here attach to the passage the paragraph rule already created; they
never change its type.

## Paragraph styles

| style | annotations on the passage |
|---|---|
| `Normal` | none |
| unknown | none — treated as `Normal` |
| `Verse` | `line-group` over the group; `line` per soft return |
| `Block` | `blockquote` |
| `Block-Verse` | `blockquote`, plus `line-group` and `line` as for `Verse` |
| `Mantra-Block` | `paragraph` and `indent` |
| `Mantra-Block-Verse` | `indent`, plus `line-group` and `line` — **no** `paragraph` |
| `Trailer` | `blockquote` |

Verse grouping runs across adjacent `Verse` paragraphs: each paragraph is its
own passage, and the annotations belong to the passage the current paragraph
produced.

## Character formatting

| run | annotation |
|---|---|
| italic | `span`, `textStyle: "emphasis"` |
| bold | `span`, `textStyle: "text-bold"` |
| underline | `span`, `textStyle: "underline"` |
| small caps | `span`, `textStyle: "small-caps"` |
| hyperlink | `link`, `href` |

Offsets are the point of these: `start` and `end` must bound exactly the styled
run within the passage's content. Combined styling — bold *and* italic over the
same words — is several `span` annotations over the same range, one per style.

Internal links import as ordinary links. Their real target does not exist until
passages are written, so correcting them is a post-import step. Flag them in the
preview; nothing automates it yet.

## Lists and tables

Word lists and tables have **no importable representation**. The annotation
kinds that would carry them — `list`, `list-item`, `table`, `table-body-row`,
`table-body-data` — have no importer and are discarded without an error.

Import the text as ordinary passages in reading order, and tell the editor in
the preview that the list or table structure was flattened. Do not emit the
unsupported kinds.
