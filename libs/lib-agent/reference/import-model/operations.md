# Import operations

The shape of the work an importer hands to the studio. Source-agnostic: a `.docx`
reader and any other importer produce the same operations, so this file is the
one place their shape is stated.

The tool is **`apply-entity-import`**, and it takes:

```json
{ "workUuid": "…", "operations": [ … ] }
```

Operations are applied in the order given, so emit them in source order. It
requires `editor.edit`.

## The four kinds

- `update_work` — patch the work row.
  `{ "kind": "update_work", "patch": { "toh": "toh44" } }`
  Also `{ "restriction": true }` for a text carrying a tantra warning.

- `upsert_title` — one title slot, a slot being a type plus a language.
  `{ "kind": "upsert_title", "title": { "content": "…", "type": "mainTitle", "language": "en" } }`
  See `titles.md` for the slots.

- `upsert_folio_annotation` — the folio metadata row.
  `{ "kind": "upsert_folio_annotation", "patch": { "source_description": "…" } }`

- `upsert_passage` — one passage and the annotations scoped to it.
  ```json
  {
    "kind": "upsert_passage",
    "passage": { "label": "1.1", "type": "translation", "content": "…" },
    "annotations": [ { "kind": "span", "start": 0, "end": 4, "data": { "textStyle": "emphasis" } } ]
  }
  ```
  See `passages.md` for types and labels, `annotations.md` for annotations.

Both title and passage operations are **upserts**: they update a matching row
and insert when there is none. There is no `insert_title` or `insert_passage`.

## What you do not supply

- **UUIDs, `sort`, and per-row `workUuid`.** The tool fills these in. `sort` is
  assigned in the order operations arrive.
- **`xmlId`.** A deprecated artifact of the original migration. The tool accepts
  it but never generates one, and new works should not have one. Leave it unset.

## Rows are not the contract

These operations are not database rows, and the difference is not cosmetic.
A passage annotation is stored as a `passage_annotations` row whose `content` is
a JSON array of kebab-case pairs — `[{"text-style":"emphasis"}]`. An importer
never writes that. It emits `data: { "textStyle": "emphasis" }` and the write
path converts. Describing an importer's output in row terms produces input the
tool cannot use.
