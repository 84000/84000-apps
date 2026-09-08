# Metadata: cover sheet, title page, canonical reference

Everything before passage generation begins. The slots these fill are in
`import-model/titles.md`.

## Cover sheet

The first one or two pages. Skip every paragraph; emit nothing. This information
is already in the database.

## Title page

### List of Titles

The lines under `List of Titles:` appear in a fixed order, each becoming one
`upsert_title`:

| line | type | language |
|---|---|---|
| 1 | `mainTitle` | `Bo-Ltn` |
| 2 | `mainTitle` | `bo` |
| 3 | `mainTitle` | `en` |
| 4 | `mainTitle` | `Sa-Ltn` |
| 5 | `longTitle` | `bo` |
| 6 | `longTitle` | `Bo-Ltn` |
| 7 | `longTitle` | `en` |
| 8 | `longTitle` | `Sa-Ltn` |
| 9 | `longTitle` | `zh` |

Preserve source order. A missing line emits nothing for that slot — do not shift
the remaining lines up to fill it, since the order is what identifies them. If
the count does not match, identify each line by its script and content rather
than its position, and note it in the preview.

### Additional Titles

Every line under `Additional Titles:` becomes one `upsert_title` with type
`otherTitle`, in source order.

## Canonical Reference

Three lines, in order:

1. **Toh** — `update_work` with `{ "toh": "toh{number}" }`.
2. **Source description** — `upsert_folio_annotation` with
   `{ "source_description": "…" }`.
3. **Tantra warning** — when the line contains `☒`, `update_work` with
   `{ "restriction": true }`. No warning means no operation; do not send
   `false`.

The source description may carry more than the studio stores; only
`source_description` is required here.
