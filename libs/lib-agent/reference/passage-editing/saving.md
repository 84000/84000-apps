# Saving a changed passage

The unit of write is the **passage**, not the annotation. There is no API that
adds or removes one annotation: a passage is saved with its annotations, and the
stored set is replaced by the set you send.

Use the `upsert_passage` operation — see `reference/import-model/operations.md`
for its shape and `reference/import-model/annotations.md` for the annotation
kinds it accepts.

## Send the whole annotation set

**Any annotation you leave out is deleted.** A passage that carries a dozen
glossary instances and an end-note link needs all of them in the payload, at
their post-edit offsets, or they are gone.

So editing one annotation means reading the passage's whole set, re-mapping the
offsets of the ones you did not touch (`offsets.md`), and sending everything
back together.

Two things make that round-trip lossy if you are not careful:

- **A kind with no importer is dropped silently** — no error, no warning, and
  then deleted as absent. Check your set against the importable kinds in
  `reference/import-model/annotations.md` *before* you write, not after.
- **The `deprecated-*` types cannot be round-tripped at all.** A read maps them
  to `unknown`, so their identity is already lost before you write. A passage
  carrying one cannot be saved without destroying it. Stop and tell the editor
  rather than proceeding.

## Carry the existing values through

A first-time import lets the tool fill in identifiers. **Editing an existing
passage is the opposite: supply what it already has, or you overwrite it.**

| field | if you omit it |
|---|---|
| `uuid` | a new passage is inserted beside the one you meant to change |
| `xmlId` | replaced with `docx-<sort>` — and passages reference each other by `xmlId` |
| `sort` | reassigned from a counter, reordering the work |
| `label`, `type` | rewritten to whatever you sent |

An annotation operation may also carry a `uuid`. Send the stored one for every
annotation that already exists. Omitted, the uuid is derived from the
annotation's kind and position — so a shifted offset yields a new identity, and
the row is deleted and re-inserted rather than updated. Other rows reference
annotations by uuid.

## Inserting a new passage

A passage you are adding is the one case with no existing values to preserve: it
takes a fresh `uuid` and a `sort` that places it between its neighbours. Give it
the `label` the convention calls for — which is sometimes none.

## Unchanged passages stay out of the payload

Send only the passages you changed. An unchanged passage in the payload is not
harmless: it is a full replacement of its annotation set, with every hazard
above, for no benefit.
