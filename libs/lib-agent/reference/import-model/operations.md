# Import operations

The shape of the work an importer hands to the studio. Source-agnostic: a `.docx`
reader and any other importer produce the same operations, so this file is the
one place their shape is stated.

The tool is **`apply-work-edits`**, and an import sends it:

```json
{ "workUuid": "…", "ops": [ … ], "dryRun": true }
```

Emit the ops in source order: an omitted `sort` is assigned in the order the
`upsert-passage` ops arrive. The work-metadata ops (`update-work`,
`upsert-title`, `upsert-folio-annotation`) are written first, then the
passages. It requires `editor.edit`.

`dryRun: true` plans every op against what is stored and returns the planned
changes without writing: the work fields with their stored values, each title
as an insert or an update, and each passage as an insert or an update. Run it
first and show the editor the result.

## The four import ops

- `update-work` — patch the work row.
  `{ "op": "update-work", "patch": { "toh": "toh44" } }`
  Also `{ "restriction": true }` for a text carrying a tantra warning.

- `upsert-title` — one title slot, a slot being a type plus a language.
  `{ "op": "upsert-title", "title": { "content": "…", "type": "mainTitle", "language": "en" } }`
  See `titles.md` for the slots.

- `upsert-folio-annotation` — the work's folio metadata rows. Only
  `source_description` is written.
  `{ "op": "upsert-folio-annotation", "patch": { "source_description": "…" } }`

- `upsert-passage` — one passage and the annotations scoped to it.
  ```json
  {
    "op": "upsert-passage",
    "passage": { "label": "1.1", "type": "translation", "content": "…" },
    "annotations": [{ "kind": "span", "start": 0, "end": 4, "data": { "textStyle": "emphasis" } }]
  }
  ```
  See `passages.md` for types and labels, `annotations.md` for annotations.

Both title and passage ops are **upserts**: they update a matching row and
insert when there is none. There is no separate insert op.

The three work-metadata ops also take an `expect` guard: the stored values you
read, by field, e.g. `"expect": { "toh": "toh1" }`. If any differs the whole
call is refused and nothing is written. Send it when you change a value that
is already set.

`upsert-passage` cannot be mixed with the passage edit ops (`delete-text` and
the rest, in `passage-editing/saving.md`) in one call.

The older `apply-entity-import` tool takes the same import as `operations`
with snake_case `kind`s (`update_work`, …). It is kept only for plugins that
have not updated; do not use it.

## What you do not supply — when filling an empty work

- **UUIDs, `sort`, and per-row `workUuid`.** The tool fills these in. `sort` is
  assigned in the order the ops arrive.
- **`xmlId`.** A deprecated artifact of the original migration. Leave it unset:
  the tool fills in `docx-<sort>`, and publishing strips it. The tool also keys
  a passage's derived uuid on it, which is what lets a failed import be re-run
  (see `passage-editing/saving.md`).

**Editing a passage that already exists inverts part of this.** `uuid` and
`sort` must be supplied with the values the row already has. An omitted `uuid`
is derived from the work and `docx-<sort>`: it matches a passage only if an
earlier import of this work saved it at that sort, and otherwise inserts a
second passage beside the one you meant to change. The whole call is refused,
and nothing is written, if an edit has since moved that passage out of order
among this import's passages, or if the work holds passages an older import
saved under uuids it cannot match. A single passage's move, or one past
passages the import does not send, is not detected (see
`passage-editing/saving.md`). An omitted `sort` is taken from a counter in
op order, and the derived uuid keys on that sort. A derived uuid never
repeats one you sent.

`workUuid` and `xmlId` stay optional either way. `workUuid` falls back to the
one you passed the tool, which is the same work you are editing; `xmlId` is
filled with `docx-<sort>`.

The same inversion applies to the annotations. An annotation may carry
a `uuid`; send the stored one for every annotation that already exists, or the
derived uuid changes with the offset and the row is deleted and re-inserted
rather than updated.

## Rows are not the contract

These ops are not database rows, and the difference is not cosmetic.
A passage annotation is stored as a `passage_annotations` row whose `content` is
a JSON array of kebab-case pairs — `[{"text-style":"emphasis"}]`. An importer
never writes that. It emits `data: { "textStyle": "emphasis" }` and the write
path converts. Describing an importer's output in row terms produces input the
tool cannot use.
