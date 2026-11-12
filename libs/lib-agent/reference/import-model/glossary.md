# Glossary entry ops

How to write a work's glossary entries through **`apply-work-edits`**. An entry
belongs to one work. It points at an **authority** (the term's library-wide
record, shared by every work that glosses it) and lists its **names**, one per
language form, the **root** (main) name first. Authorities and names rows can
be shared across works, so these ops may add them but never edit one another
entry uses in place.

All four ops need `editor.edit`. They form the `glossary` group, which is
written after `work-metadata` and `passages`, in **one transaction**: every
entry of the call (and every new authority) is written, or none is. A call may
name an entry in at most one glossary op.

Read the entry before changing it. `get-glossary-term` with `source: "draft"`
gives its authority, definition and names by language. The whole stored
entry, with every field `expect` can name (`definitionRend`, `glossMode`, each
name's `attestation` and `termType`), is the `before` of a dry run of any op on
it.

## The four ops

- `upsert-glossary-entry` — the whole entry. Creates it when no entry has its
  `uuid`; otherwise makes the stored entry equal to it.

  ```json
  {
    "op": "upsert-glossary-entry",
    "entry": {
      "authority": "…authority uuid…",
      "definition": "<p>…</p>",
      "names": [
        { "language": "en", "content": "mind", "termType": "translationMain" },
        { "language": "Bo-Ltn", "content": "sems", "contentTransformed": "སེམས", "attestation": "attestedSource" },
        { "language": "Sa-Ltn", "content": "citta", "attestation": "attestedDictionary" }
      ]
    }
  }
  ```

  Omit `uuid` on a new entry: it is derived from the work, the authority and
  the root name, so re-sending the same op updates that entry (and writes
  nothing when nothing differs) instead of adding a second one. An omitted
  `definition`, `definitionRend` or `glossMode` keeps the stored value. A
  different `authority` relinks the entry, as below. Without `expect` the op
  overwrites whatever is stored when the call is planned.

- `patch-glossary-entry` — set some fields of an existing entry, each with the
  stored value you read.

  ```json
  {
    "op": "patch-glossary-entry",
    "uuid": "…entry uuid…",
    "set": { "definition": "<p>…</p>" },
    "expect": { "definition": null }
  }
  ```

  `set` takes `definition`, `definitionRend`, `glossMode` and `names`; every
  key in `set` needs an `expect` value.

- `relink-glossary-entry` — point the entry at another authority.

  ```json
  { "op": "relink-glossary-entry", "uuid": "…", "authority": "…new…", "expect": { "authority": "…current…" } }
  ```

  A names row only this entry uses moves with it. One another entry, work or
  creator also uses is copied, and the copy moves; the others keep theirs.

- `delete-glossary-entry` — delete the entry and this work's
  `glossary-instance` annotations citing it. Its names rows and authority stay.
  `{ "op": "delete-glossary-entry", "uuid": "…" }`, `expect` optional.

`patch`, `relink` and `delete` refuse a uuid that is not an entry of the work.

## Names

`names` is always the entry's **whole** list after the op, root first; the
root cannot be removed. Give a name's `glossaryUuid` to say which stored row it
is. Otherwise names are matched to the stored ones: the first to the root, the
rest to a stored name with the same language and content, then to a leftover
stored name of the same language. A stored name nothing matches is removed; a
name nothing matches is added. So to change the text of the entry's English
name, send the list with the new text: that row is edited, or copied first if
another work shares it, never changed under the other work.

A matched name keeps any stored field you omit (`contentTransformed`,
`termType`, `attestation`); send `null` to clear one. A new `Bo-Ltn` name needs
`contentTransformed`, the Tibetan script.

Fixed values, refused otherwise:

- `attestation`: `attestedSource`, `attestedDictionary`, `attestedApproximate`,
  `attestedOther`, `reconstructedPhonetic`, `reconstructedSemantic`,
  `sourceUnspecified`.
- `termType`: `translationMain`, `translationAlternative`.
- `definitionRend`: `appendWithStandard`, `prependWithStandard`,
  `overrideWithStandard`, `incompatibleWithStandard`.
- `glossMode`: `match`, `marked` (unset reads as `match`).

## `expect`

`expect` holds the stored values you read: `authority`, `definition`,
`definitionRend`, `glossMode` and `names`. `names` lists every stored name in
any order, each matched on the fields you give. If any value differs from what
is stored, the whole call is refused before anything is written, and the error
names the field, the value you expected and the stored one. Read the entry
again and decide afresh; do not copy the stored value into `expect` and resend.

## New authorities

When no authority fits, create one with the entry:

```json
"authority": { "new": { "headword": "citta", "headwordLanguage": "Sa-Ltn", "definition": null } }
```

It is written in the same transaction as the entry and gets the next free
`entity-N` `xmlId`. Its uuid, when omitted, is derived from the entry's, so a
re-run links to the authority the first run created instead of making another.
To have two entries share one new authority, give it a `uuid` in one op and
name that uuid as the other op's `authority`. Search before creating: an
authority is library-wide, and a duplicate cannot be removed here.

## Result and re-runs

The `glossary` group's `changes` hold one item per op in `entries`
(`action` `create`, `update`, `delete` or `unchanged`, with `before`, `after`,
and the names rows it would copy or move), the authorities it creates in
`authorities`, and row counts in `rows`. With `dryRun` nothing is written and a
new authority's `xmlId` is `null`; it is assigned when applied. Dry-run first
and show the editor the result.

Create entries in one call and add the `glossary-instance` annotations citing
them in the next. In one call the passages are written first, so if the
glossary group then failed, the instances would cite entries that do not
exist.

If the group comes back `applied: "unknown"`, read the entries again with
`get-glossary-term` before sending anything. An upsert without `uuid` is safe
to resend; a patch or relink whose write landed is refused, because its
`expect` no longer matches.
